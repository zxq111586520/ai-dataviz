/**
 * AI数据可视化平台 - Express后端服务 v2
 * 功能：用户认证、数据集管理、图表管理、分享链接
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dataviz-secret-2024-ai';
const DB_PATH = path.join(__dirname, 'data', 'dataviz.db');

// ========== 中间件 ==========
app.use(cors());

// JSON解析：只在非multipart请求时生效
const rawBodySaver = express.json({ limit: '50mb' });
app.use((req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        next();
    } else {
        rawBodySaver(req, res, next);
    }
});

// 统一错误处理中间件（防止HTML错误响应）
app.use((err, req, res, next) => {
    console.error('服务器错误:', err.message, err.stack);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: err.message || '服务器内部错误',
        code: err.code || 'INTERNAL_ERROR'
    });
});

app.use(express.static(path.join(__dirname, 'public')));

// ========== 数据库 (内存存储 + JSON文件持久化) ==========
let db = {
    users: [],
    datasets: [],
    charts: []
};
let nextIds = { user: 1, dataset: 1, chart: 1 };

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf-8');
            const parsed = JSON.parse(data);
            db = parsed.db || { users: [], datasets: [], charts: [] };
            nextIds = parsed.nextIds || { user: 1, dataset: 1, chart: 1 };
            console.log('数据库加载成功，用户:', db.users.length, '数据集:', db.datasets.length, '图表:', db.charts.length);
        } else {
            saveDB();
            console.log('新建数据库文件');
        }
    } catch (err) {
        console.error('数据库加载失败:', err);
        saveDB();
    }
}

function saveDB() {
    try {
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify({ db, nextIds }, null, 2), 'utf-8');
    } catch (err) {
        console.error('数据库保存失败:', err);
    }
}

loadDB();

// ========== 文件上传配置 ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage, 
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.csv', '.xlsx', '.xls', '.json'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 CSV、Excel、JSON 格式'));
        }
    }
});

// ========== 认证中间件 ==========
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '请先登录' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '登录已过期，请重新登录' });
        }
        return res.status(401).json({ error: '登录无效' });
    }
}

// ========== 认证API ==========
// 注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: '请填写所有字段' });
        }
        if (username.length < 2 || username.length > 30) {
            return res.status(400).json({ error: '用户名长度需在2-30字符之间' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: '密码至少需要6位' });
        }
        
        // 检查重复
        const existing = db.users.find(u => u.username === username || u.email === email);
        if (existing) {
            return res.status(400).json({ error: '用户名或邮箱已被注册' });
        }
        
        // 创建用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            id: nextIds.user++,
            username,
            email,
            password: hashedPassword,
            created_at: new Date().toISOString()
        };
        db.users.push(user);
        saveDB();
        
        // 生成token
        const token = jwt.sign(
            { id: user.id, username, email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: user.id, username, email } });
    } catch (err) {
        console.error('注册错误:', err);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请输入用户名和密码' });
        }
        
        // 查找用户（支持用户名或邮箱登录）
        const user = db.users.find(u => u.username === username || u.email === username);
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

// 验证Token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at } });
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at } });
});

// ========== 数据集API ==========
// 上传数据集
app.post('/api/datasets', authMiddleware, upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '请选择要上传的文件' });
        
        const dataset = {
            id: nextIds.dataset++,
            user_id: req.user.id,
            name: req.body.name || req.file.originalname,
            filename: req.file.filename,
            original_name: req.file.originalname,
            rows: parseInt(req.body.rows) || 0,
            columns: parseInt(req.body.columns) || 0,
            size: req.body.size || formatFileSize(req.file.size),
            created_at: new Date().toISOString()
        };
        db.datasets.push(dataset);
        saveDB();
        
        res.json({ success: true, id: dataset.id, name: dataset.name, filename: dataset.filename });
    } catch (err) {
        console.error('上传错误:', err);
        res.status(500).json({ error: '上传失败：' + err.message });
    }
});

// 获取用户数据集列表
app.get('/api/datasets', authMiddleware, (req, res) => {
    const datasets = db.datasets
        .filter(d => d.user_id === req.user.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(d => ({ id: d.id, name: d.name, original_name: d.original_name, rows: d.rows, columns: d.columns, size: d.size, created_at: d.created_at }));
    res.json(datasets);
});

// 获取单个数据集（下载文件）
app.get('/api/datasets/:id', authMiddleware, (req, res) => {
    const dataset = db.datasets.find(d => d.id === parseInt(req.params.id) && d.user_id === req.user.id);
    if (!dataset) return res.status(404).json({ error: '数据集不存在' });
    const filePath = path.join(__dirname, 'uploads', dataset.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
    res.download(filePath, dataset.original_name);
});

// 读取数据集内容
app.get('/api/datasets/:id/content', authMiddleware, (req, res) => {
    const dataset = db.datasets.find(d => d.id === parseInt(req.params.id) && d.user_id === req.user.id);
    if (!dataset) return res.status(404).json({ error: '数据集不存在' });
    const filePath = path.join(__dirname, 'uploads', dataset.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
    
    const filename = dataset.original_name || dataset.filename;
    const ext = filename.toLowerCase();
    
    // Excel文件直接返回二进制base64，由前端SheetJS解析
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        const buf = fs.readFileSync(filePath);
        const base64 = buf.toString('base64');
        return res.json({
            type: 'excel',
            data: base64,
            dataset
        });
    }
    
    // CSV/JSON文件 - 读取并清理BOM
    try {
        let content = fs.readFileSync(filePath);
        
        // 移除UTF-8 BOM (EF BB BF)
        if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
            content = content.slice(3);
        }
        
        // 尝试检测编码并转换为UTF-8
        let text = content.toString('utf-8');
        
        // 如果内容看起来是乱码，尝试GBK解码
        if (text.includes('�') || text.includes('\uFFFD')) {
            try {
                text = content.toString('gbk');
            } catch (e) {
                // 保持UTF-8
            }
        }
        
        // 清理不可见字符和多余空白
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        res.json({
            type: 'text',
            content: text,
            dataset
        });
    } catch (err) {
        console.error('读取文件失败:', err);
        return res.status(500).json({ error: '文件读取失败：' + err.message });
    }
});

// 删除数据集
app.delete('/api/datasets/:id', authMiddleware, (req, res) => {
    const idx = db.datasets.findIndex(d => d.id === parseInt(req.params.id) && d.user_id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: '数据集不存在' });
    
    const dataset = db.datasets[idx];
    const filePath = path.join(__dirname, 'uploads', dataset.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    db.datasets.splice(idx, 1);
    saveDB();
    res.json({ success: true });
});

// ========== 图表API ==========
// 保存图表
app.post('/api/charts', authMiddleware, (req, res) => {
    try {
        const { title, chart_type, options, dataset_id } = req.body;
        
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: '请输入图表标题' });
        }
        
        const chart = {
            id: nextIds.chart++,
            user_id: req.user.id,
            title: title.trim(),
            chart_type: chart_type || 'line',
            options: typeof options === 'string' ? options : JSON.stringify(options || {}),
            dataset_id: dataset_id || null,
            share_id: generateShareId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        db.charts.push(chart);
        saveDB();
        
        res.json({ success: true, id: chart.id, share_id: chart.share_id });
    } catch (err) {
        console.error('保存图表错误:', err);
        res.status(500).json({ error: '保存失败：' + err.message });
    }
});

// 获取用户图表列表
app.get('/api/charts', authMiddleware, (req, res) => {
    const charts = db.charts
        .filter(c => c.user_id === req.user.id)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .map(c => ({ id: c.id, title: c.title, chart_type: c.chart_type, share_id: c.share_id, created_at: c.created_at, updated_at: c.updated_at }));
    res.json(charts);
});

// 获取单个图表
app.get('/api/charts/:id', authMiddleware, (req, res) => {
    const chart = db.charts.find(c => c.id === parseInt(req.params.id) && c.user_id === req.user.id);
    if (!chart) return res.status(404).json({ error: '图表不存在' });
    res.json({
        id: chart.id, user_id: chart.user_id, title: chart.title,
        chart_type: chart.chart_type, options: JSON.parse(chart.options || '{}'),
        dataset_id: chart.dataset_id, share_id: chart.share_id,
        created_at: chart.created_at, updated_at: chart.updated_at
    });
});

// 更新图表
app.put('/api/charts/:id', authMiddleware, (req, res) => {
    const idx = db.charts.findIndex(c => c.id === parseInt(req.params.id) && c.user_id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: '图表不存在' });
    
    const { title, chart_type, options, dataset_id } = req.body;
    db.charts[idx] = {
        ...db.charts[idx],
        title: title || db.charts[idx].title,
        chart_type: chart_type || db.charts[idx].chart_type,
        options: typeof options === 'string' ? options : (options ? JSON.stringify(options) : db.charts[idx].options),
        dataset_id: dataset_id !== undefined ? dataset_id : db.charts[idx].dataset_id,
        updated_at: new Date().toISOString()
    };
    saveDB();
    res.json({ success: true });
});

// 删除图表
app.delete('/api/charts/:id', authMiddleware, (req, res) => {
    const idx = db.charts.findIndex(c => c.id === parseInt(req.params.id) && c.user_id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: '图表不存在' });
    db.charts.splice(idx, 1);
    saveDB();
    res.json({ success: true });
});

// ========== 分享API ==========
// 生成分享链接
app.post('/api/charts/:id/share', authMiddleware, (req, res) => {
    const chart = db.charts.find(c => c.id === parseInt(req.params.id) && c.user_id === req.user.id);
    if (!chart) return res.status(404).json({ error: '图表不存在' });
    
    if (!chart.share_id) {
        chart.share_id = generateShareId();
        saveDB();
    }
    
    res.json({
        share_id: chart.share_id,
        share_url: `${req.protocol}://${req.get('host')}/share/${chart.share_id}`
    });
});

// 获取分享的图表（公开访问）
app.get('/api/share/:shareId', (req, res) => {
    const chart = db.charts.find(c => c.share_id === req.params.shareId);
    if (!chart) return res.status(404).json({ error: '图表不存在或已被删除' });
    
    const author = db.users.find(u => u.id === chart.user_id);
    res.json({
        id: chart.id, title: chart.title, chart_type: chart.chart_type,
        options: JSON.parse(chart.options || '{}'),
        author_name: author ? author.username : '匿名用户',
        created_at: chart.created_at
    });
});

// ========== 分享页面 ==========
app.get('/share/:shareId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

// ========== SPA路由 ==========
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== 辅助函数 ==========
function generateShareId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========== 确保目录存在 ==========
[path.join(__dirname, 'uploads'), path.join(__dirname, 'data')].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('创建目录:', dir);
    }
});

// ========== 启动服务器 ==========
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║   🚀 AI数据可视化平台 已启动                               ║');
    console.log(`║   📍 本地访问: http://localhost:${PORT}                        ║`);
    console.log('║                                                            ║');
    console.log('║   📝 功能说明:                                              ║');
    console.log('║      • 注册/登录账号系统                                    ║');
    console.log('║      • 上传和管理数据集                                     ║');
    console.log('║      • 创建和保存图表                                       ║');
    console.log('║      • 生成分享链接                                         ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
});
