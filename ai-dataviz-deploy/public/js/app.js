/**
 * AI数据可视化平台 - 核心应用逻辑
 * 版本：v2.0
 * 技术栈：Vanilla JS + ECharts 5
 */

// ==================== 全局状态 ====================
const AppState = {
    currentPage: 'dashboard',
    currentData: null,
    currentFields: [],
    currentChartType: 'line',
    currentDatasetId: null,
    chartInstance: null,
    chartOptions: {},
    history: [],
    historyIndex: -1,
    userDatasets: [],
    userCharts: [],
    currentUser: null,
    exportHistory: 0,
    favorites: [],
    colorSchemes: {
        nature: ['#2D6BE4', '#00D4B4', '#FF6B6B', '#F59E0B', '#8B5CF6', '#10B981', '#F97316', '#EC4899'],
        bw: ['#1A1D23', '#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0', '#334155', '#475569', '#1E293B'],
        gradient: ['#2D6BE4', '#00D4B4', '#FF6B6B', '#F59E0B', '#8B5CF6', '#10B981', '#F97316', '#EC4899'],
        cb: ['#0077BB', '#EE7733', '#009988', '#CC3311', '#33BBEE', '#EE3377', '#BBBBBB', '#228833'],
        vibrant: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'],
        elegant: ['#2C3E50', '#3498DB', '#E74C3C', '#27AE60', '#9B59B6', '#F39C12', '#1ABC9C', '#E67E22']
    },
    journalPresets: {
        nature: { width: 89, height: 60, dpi: 300, font: 'Arial', lineWidth: 0.5 },
        science: { width: 86, height: 55, dpi: 300, font: 'Arial', lineWidth: 0.5 },
        ieee: { width: 86, height: 60, dpi: 300, font: 'Times New Roman', lineWidth: 0.5 },
        cell: { width: 100, height: 70, dpi: 300, font: 'Arial', lineWidth: 0.5 },
        elsevier: { width: 90, height: 65, dpi: 300, font: 'Times New Roman', lineWidth: 0.5 }
    }
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    // 检查登录状态
    await initAuth();
    
    // 初始化导航
    initNavigation();
    
    // 初始化上传功能
    initUpload();
    
    // 初始化导出选项
    initExportOptions();
    
    // 窗口调整监听
    window.addEventListener('resize', () => {
        if (AppState.chartInstance) AppState.chartInstance.resize();
    });
    
    showToast('欢迎使用 AI 数据可视化平台！📊', 'success');
});

// ==================== 认证相关 ====================
async function initAuth() {
    if (Auth.isLoggedIn()) {
        try {
            AppState.currentUser = await Auth.getMe();
            updateNavForLoggedInUser();
            document.getElementById('searchBox').style.display = 'flex';
        } catch (err) {
            console.log('Token验证失败:', err);
            Auth.clearAuth();
            updateNavForGuest();
        }
    } else {
        updateNavForGuest();
        updateNavForLoggedInUser();
    }
}

function updateNavForGuest() {
    document.getElementById('navActions').innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="showLoginModal()">登录</button>
        <button class="btn btn-primary btn-sm" onclick="showRegisterModal()">注册</button>
    `;
    document.getElementById('searchBox').style.display = 'none';
    document.getElementById('welcomeSection').innerHTML = `
        <h1>👋 欢迎使用！</h1>
        <p>登录后可保存图表、管理数据、分享给他人</p>
    `;
}

function updateNavForLoggedInUser() {
    const user = Auth.getUser();
    if (!user) return;
    
    document.getElementById('navActions').innerHTML = `
        <div class="user-menu">
            <div class="user-avatar" onclick="toggleUserMenu()">${user.username.charAt(0).toUpperCase()}</div>
            <div class="user-dropdown" id="userDropdown" style="display:none;">
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-email">${user.email}</div>
                </div>
                <div class="dropdown-divider"></div>
                <a href="#" onclick="loadUserCharts(); return false;">📊 我的图表</a>
                <a href="#" onclick="loadUserDatasets(); return false;">📁 我的数据</a>
                <a href="#" onclick="showSettings(); return false;">🔧 设置</a>
                <div class="dropdown-divider"></div>
                <a href="#" onclick="handleLogout(); return false;" class="logout-link">🚪 退出登录</a>
            </div>
        </div>
    `;
    document.getElementById('searchBox').style.display = 'flex';
    document.getElementById('welcomeSection').innerHTML = `
        <h1>👋 ${user.username}，欢迎回来！</h1>
        <p>开始创建你的数据可视化作品</p>
    `;
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// 点击其他地方关闭用户菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

async function loadUserData() {
    await Promise.all([
        loadUserDatasets(),
        loadUserCharts()
    ]);
    updateStatCards();
}

function showLoginModal() {
    closeModal('registerModal');
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
}

function showRegisterModal() {
    closeModal('loginModal');
    document.getElementById('registerModal').style.display = 'flex';
    document.getElementById('registerError').style.display = 'none';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function switchToRegister() {
    closeModal('loginModal');
    showRegisterModal();
}

function switchToLogin() {
    closeModal('registerModal');
    showLoginModal();
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showFormError('loginError', '请输入用户名和密码');
        return;
    }
    
    try {
        const data = await Auth.login(username, password);
        AppState.currentUser = data.user;
        closeModal('loginModal');
        updateNavForLoggedInUser();
        loadUserData();
        showToast(`欢迎回来，${data.user.username}！🎉`, 'success');
    } catch (err) {
        showFormError('loginError', err.message);
    }
}

async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    
    if (!username || !email || !password || !password2) {
        showFormError('registerError', '请填写所有字段');
        return;
    }
    
    if (password !== password2) {
        showFormError('registerError', '两次输入的密码不一致');
        return;
    }
    
    try {
        const data = await Auth.register(username, email, password);
        AppState.currentUser = data.user;
        closeModal('registerModal');
        updateNavForLoggedInUser();
        showToast(`注册成功，欢迎 ${data.user.username}！🎉`, 'success');
    } catch (err) {
        showFormError('registerError', err.message);
    }
}

function handleLogout() {
    Auth.logout();
    AppState.currentUser = null;
    AppState.userDatasets = [];
    AppState.userCharts = [];
    updateNavForGuest();
    updateStatCards();
    document.getElementById('recentProjects').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div class="empty-text">登录后查看您的图表</div>
        </div>
    `;
    document.getElementById('datasetItems').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📂</div>
            <div class="empty-text">暂无数据集</div>
        </div>
    `;
    showToast('已退出登录', 'info');
}

function showFormError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.style.display = 'block';
}

// 回车登录/注册
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (document.getElementById('loginModal').style.display !== 'none') {
            handleLogin();
        } else if (document.getElementById('registerModal').style.display !== 'none') {
            handleRegister();
        }
    }
});

// ==================== 页面导航 ====================
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
}

function navigateTo(page) {
    // 关闭模态框
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    
    // 切换页面显示
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById('page-' + page);
    if (target) {
        target.classList.add('active');
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
        AppState.currentPage = page;
        
        // 页面特定逻辑
        if (page === 'export') {
            setTimeout(() => renderExportPreview(), 100);
        }
        if (page === 'editor') {
            renderThumbnails();
            loadUserDatasetsToSelector();
        }
        if (page === 'upload') {
            loadUserDatasets();
        }
        if (page === 'dashboard') {
            if (Auth.isLoggedIn()) {
                loadUserData();
            }
        }
    }
    
    // 更新侧边栏
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    
    // 滚动到顶部
    window.scrollTo(0, 0);
}

// ==================== 数据加载 ====================
async function loadDataset(name) {
    if (!Auth.isLoggedIn()) {
        showLoginModal();
        showToast('请先登录后使用数据集功能', 'warning');
        return;
    }
    
    try {
        showToast('正在加载数据...', 'info');
        const response = await fetch(`data/${name}.csv`);
        if (!response.ok) throw new Error('加载失败');
        const text = await response.text();
        const data = parseData(text, name + '.csv');
        AppState.currentData = data;
        AppState.currentFields = Object.keys(data[0] || {});
        AppState.currentDatasetId = name; // 示例数据用名称标识
        showDataPreview(data);
        navigateTo('editor');
        updateFieldSelectors();
        autoSelectFields();
        updateChart();
        runAIAnalysis();
        showToast(`成功加载示例数据：${data.length} 行`, 'success');
    } catch (e) {
        showToast('数据加载失败：' + e.message, 'error');
    }
}

async function loadUserDatasets(filter = 'all') {
    if (!Auth.isLoggedIn()) return;
    
    try {
        const datasets = await Auth.request('/api/datasets');
        AppState.userDatasets = datasets;
        
        const container = document.getElementById('datasetItems');
        if (!datasets || datasets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <div class="empty-text">暂无数据集</div>
                    <div class="empty-hint">上传CSV或Excel文件开始分析</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = datasets.map(ds => `
            <div class="dataset-item" onclick="loadUserDataset(${ds.id})">
                <div class="dataset-icon">📄</div>
                <div class="dataset-info">
                    <div class="dataset-name">${ds.name}</div>
                    <div class="dataset-meta">${ds.rows || '?'} 行 · ${ds.columns || '?'} 列 · ${ds.size || ''}</div>
                </div>
                <div class="dataset-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteDataset(${ds.id})" title="删除">🗑️</button>
                </div>
            </div>
        `).join('');
        
        document.getElementById('statDatasets').textContent = datasets.length;
    } catch (err) {
        console.error('加载数据集失败:', err);
    }
}

async function loadUserDataset(id) {
    try {
        showToast('正在加载数据集...', 'info');
        const response = await Auth.request(`/api/datasets/${id}/content`);
        
        let data;
        
        if (response.type === 'excel' && response.data) {
            // Excel文件：服务器返回base64，前端用SheetJS解析
            const binaryString = atob(response.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            // 使用header:1读取原始数据，手动处理表头
            const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', header: 1 });
            if (rawData.length < 2) throw new Error('Excel文件为空或格式不正确');
            
            // 找出有多少个有效列（统计每行非空值数量，最多那个就是真实列数）
            const colCounts = rawData.map(row => (row || []).filter(v => v !== '' && v !== null && v !== undefined).length);
            const maxCols = Math.max(...colCounts);
            
            // 如果第一行只有1个非空值（合并单元格标题），则用第二行作表头
            const firstRowNonEmpty = colCounts[0] || 0;
            let headerRowIdx = 0;
            if (firstRowNonEmpty <= 2 || maxCols > firstRowNonEmpty + 1) {
                headerRowIdx = 1; // 第二行是表头
            }
            
            const rawHeaders = (rawData[headerRowIdx] || []).map(h => String(h || '').trim()).filter(h => h !== '');
            
            // 如果第二行也没有效列名，尝试第三行
            if (rawHeaders.length === 0 && rawData.length > 2) {
                headerRowIdx = 2;
            }
            
            const headers = (rawData[headerRowIdx] || []).map(h => String(h || '').trim()).filter(h => h !== '');
            if (headers.length === 0) throw new Error('无法识别Excel表头，请确保文件有列名行');
            
            const dataStart = headerRowIdx + 1;
            
            data = [];
            for (let i = dataStart; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;
                const item = {};
                headers.forEach((h, idx) => {
                    let v = row[idx];
                    if (v && typeof v === 'object' && v.constructor?.name === 'Date') v = v.toISOString().slice(0, 10);
                    // 数字处理：保留原始值或解析字符串数字
                    if (typeof v === 'number') {
                        // Excel数字不变
                    } else if (typeof v === 'string') {
                        const parsed = parseFloat(v.replace(/,/g, ''));
                        if (!isNaN(parsed)) v = parsed;
                    }
                    item[h] = (v === null || v === undefined) ? '' : v;
                });
                if (Object.values(item).some(val => val !== '' && val !== null)) data.push(item);
            }
        } else if (response.type === 'text' && response.content) {
            // CSV/JSON文件
            data = parseData(response.content, response.dataset.original_name);
        } else {
            throw new Error('无法解析数据：未知格式');
        }
        
        if (!data || data.length === 0) {
            throw new Error('数据为空，请检查文件内容');
        }
        
        AppState.currentData = data;
        AppState.currentFields = Object.keys(data[0] || {});
        AppState.currentDatasetId = id;
        
        showDataPreview(data);
        navigateTo('editor');
        updateFieldSelectors();
        autoSelectFields();
        updateChart();
        runAIAnalysis();
        
        // 更新数据源选择器
        const selector = document.getElementById('dataSource');
        if (selector) {
            selector.value = id;
            onDataSourceChange();
        }
        
        showToast(`成功加载：${data.length} 行 × ${AppState.currentFields.length} 列`, 'success');
    } catch (err) {
        console.error('加载数据集失败:', err);
        showToast('加载失败：' + err.message, 'error');
    }
}

async function deleteDataset(id) {
    if (!confirm('确定要删除这个数据集吗？')) return;
    
    try {
        await Auth.request(`/api/datasets/${id}`, { method: 'DELETE' });
        showToast('数据集已删除', 'success');
        loadUserDatasets();
        document.getElementById('statDatasets').textContent = Math.max(0, parseInt(document.getElementById('statDatasets').textContent) - 1);
    } catch (err) {
        showToast('删除失败：' + err.message, 'error');
    }
}

function preloadSampleData() {
    const datasets = ['economic_data', 'university_rankings', 'monthly_weather', 'retail_sales', 'gene_expression'];
    datasets.forEach(async (name) => {
        try {
            const response = await fetch(`data/${name}.csv`);
            const text = await response.text();
            AppState.datasets[name] = parseData(text, name + '.csv');
        } catch (e) {
            console.log('预加载失败:', name);
        }
    });
}

/**
 * 通用数据解析器 - 支持 CSV、JSON、Excel
 */
function parseData(content, filename) {
    if (!content) return [];
    const ext = (filename || '').toLowerCase();
    
    // Excel 文件 (.xlsx, .xls)
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.includes('spreadsheet')) {
        try {
            const workbook = XLSX.read(content, { type: 'string', cellDates: true });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
            return json.map(row => {
                const clean = {};
                Object.keys(row).forEach(k => {
                    const v = row[k];
                    // 清理 Excel 日期序列号
                    if (v && typeof v === 'object' && v.constructor?.name === 'Date') {
                        clean[k] = v.toISOString().slice(0, 10);
                    } else if (typeof v === 'number' && v > 25569 && v < 2958465 && k.toLowerCase().includes('date')) {
                        // Excel 日期序列号转换
                        const date = new Date((v - 25569) * 86400 * 1000);
                        clean[k] = date.toISOString().slice(0, 10);
                    } else {
                        clean[k] = isNaN(parseFloat(v)) ? (v === null ? '' : String(v)) : parseFloat(v);
                    }
                });
                return clean;
            });
        } catch (e) {
            console.error('Excel解析失败:', e);
            showToast('Excel解析失败：' + e.message, 'error');
            return [];
        }
    }
    
    // JSON 文件
    if (ext.endsWith('.json')) {
        try {
            const arr = typeof content === 'string' ? JSON.parse(content) : content;
            return Array.isArray(arr) ? arr : [arr];
        } catch (e) {
            console.error('JSON解析失败:', e);
            showToast('JSON解析失败：' + e.message, 'error');
            return [];
        }
    }
    
    // CSV 文件（默认）
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => {
            const v = values[i] || '';
            row[h] = isNaN(parseFloat(v)) ? v.trim() : parseFloat(v);
        });
        return row;
    });
}

function parseCSVLine(line) {
    const result = [], current = [];
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQuotes = !inQuotes; }
        else if (c === ',' && !inQuotes) {
            result.push(current.join(''));
            current.length = 0;
        } else { current.push(c); }
    }
    result.push(current.join(''));
    return result;
}

// ==================== 数据预览 ====================
function showDataPreview(data) {
    const container = document.getElementById('dataPreview');
    const table = document.getElementById('previewTable');
    const info = document.getElementById('previewInfo');
    const fields = document.getElementById('fieldInfo');
    
    if (!data || data.length === 0) { container.style.display = 'none'; return; }
    
    container.style.display = 'block';
    document.getElementById('dataCleaning').style.display = 'block';
    
    // 更新步骤指示
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    document.getElementById('step3').classList.add('active');
    
    const fieldNames = Object.keys(data[0]);
    
    info.innerHTML = `
        <span>📊 共 <strong>${data.length}</strong> 行</span>
        <span>📋 共 <strong>${fieldNames.length}</strong> 列</span>
    `;
    
    // 表头
    let thead = '<thead><tr>';
    fieldNames.forEach(h => thead += `<th>${h}</th>`);
    thead += '</tr></thead>';
    
    // 数据行
    let tbody = '<tbody>';
    data.slice(0, 100).forEach(row => {
        tbody += '<tr>';
        fieldNames.forEach(h => {
            const v = row[h];
            const display = v === null || v === undefined || v === '' ? '<span class="field-null">空</span>' : v;
            tbody += `<td>${display}</td>`;
        });
        tbody += '</tr>';
    });
    if (data.length > 100) tbody += `<tr><td colspan="${fieldNames.length}" style="text-align:center;color:var(--text-secondary)">... 还有 ${data.length - 100} 行</td></tr>`;
    tbody += '</tbody>';
    
    table.innerHTML = thead + tbody;
    
    // 字段信息
    fields.innerHTML = fieldNames.map(f => {
        const values = data.map(r => r[f]);
        const nums = values.filter(v => typeof v === 'number');
        const type = nums.length > values.length * 0.5 ? '数值' : '文本';
        const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
        return `<span class="field-tag">${f} <span class="field-type">${type}</span>${nullCount > 0 ? ` <span class="field-null">${nullCount}空</span>` : ''}</span>`;
    }).join('');
}

function useDataset() {
    if (AppState.currentData && AppState.currentData.length > 0) {
        navigateTo('editor');
        updateFieldSelectors();
        autoSelectFields();
        updateChart();
    }
}

// ==================== 可视化编辑器 ====================
function loadUserDatasetsToSelector() {
    const selector = document.getElementById('dataSource');
    if (!selector) return;
    
    let options = '<option value="">-- 选择数据集 --</option>';
    
    // 添加示例数据
    options += '<optgroup label="示例数据">';
    options += '<option value="economic_data">经济数据 2015-2024</option>';
    options += '<option value="university_rankings">中国高校排名数据</option>';
    options += '<option value="monthly_weather">月度气候数据</option>';
    options += '<option value="retail_sales">零售市场销售数据</option>';
    options += '<option value="gene_expression">基因表达谱数据</option>';
    options += '</optgroup>';
    
    // 添加用户数据
    if (AppState.userDatasets && AppState.userDatasets.length > 0) {
        options += '<optgroup label="我的数据">';
        AppState.userDatasets.forEach(ds => {
            options += `<option value="${ds.id}">${ds.name}</option>`;
        });
        options += '</optgroup>';
    }
    
    selector.innerHTML = options;
}

function onDataSourceChange() {
    const selector = document.getElementById('dataSource');
    const value = selector.value;
    const dataInfo = document.getElementById('dataInfo');
    
    if (!value) {
        AppState.currentData = null;
        AppState.currentFields = [];
        AppState.currentDatasetId = null;
        showCanvasEmpty(true);
        return;
    }
    
    dataInfo.style.display = 'block';
    
    // 检查是否是示例数据
    const sampleDatasets = ['economic_data', 'university_rankings', 'monthly_weather', 'retail_sales', 'gene_expression'];
    
    if (sampleDatasets.includes(value)) {
        // 加载示例数据
        loadDataset(value);
    } else {
        // 加载用户数据
        loadUserDataset(parseInt(value));
    }
}

function updateFieldSelectors() {
    const fields = AppState.currentFields;
    if (!fields || fields.length === 0) return;
    
    ['xAxisField', 'yAxisField', 'colorField', 'sizeField'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = `<option value="">-- 无 --</option>` + fields.map(f => `<option value="${f}">${f}</option>`).join('');
        if (fields.includes(current)) sel.value = current;
    });
    
    // 更新数据信息
    document.getElementById('dataRows').textContent = (AppState.currentData?.length || 0) + ' 行';
    document.getElementById('dataCols').textContent = (AppState.currentFields?.length || 0) + ' 列';
}

function autoSelectFields() {
    if (!AppState.currentFields || AppState.currentFields.length === 0) return;
    const fields = AppState.currentFields;
    
    // 优先关键词（精确匹配）
    const namePriority = ['姓名', 'name', '名称', '产品', '城市', '国家'];
    const valuePriority = ['工资', '月薪', 'salary', '收入', '金额', 'price', 'sales', '得分', 'score'];
    const deptPriority = ['部门', '职位', '类别', 'category', 'class', 'type', 'dept'];
    
    let xField = null, yField = null, colorField = null;
    
    // X轴：精确找"姓名"、"名称"等（优先于"员工编号"）
    for (const f of fields) {
        if (namePriority.some(k => f === k)) { xField = f; break; }
    }
    if (!xField) {
        for (const f of fields) {
            if (f.includes('姓名') || f === 'name') { xField = f; break; }
        }
    }
    if (!xField) xField = fields[0]; // 默认第一列
    
    // Y轴：精确找数值字段
    for (const f of fields) {
        if (valuePriority.some(k => f.includes(k))) { yField = f; break; }
    }
    if (!yField) {
        const numericFields = fields.filter(f => AppState.currentData?.some(r => typeof r[f] === 'number' && r[f] > 0));
        yField = numericFields[numericFields.length - 1] || fields[fields.length - 1];
    }
    
    // 颜色/分类字段
    for (const f of fields) {
        if (f === xField || f === yField) continue;
        if (deptPriority.some(k => f.includes(k))) { colorField = f; break; }
    }
    
    // 更新UI
    const xSel = document.getElementById('xAxisField');
    const ySel = document.getElementById('yAxisField');
    const cSel = document.getElementById('colorField');
    if (xSel) {
        xSel.innerHTML = '<option value="">-- 无 --</option>' + fields.map(f => `<option value="${f}">${f}</option>`).join('');
        if (fields.includes(xField)) xSel.value = xField;
    }
    if (ySel) {
        ySel.innerHTML = '<option value="">-- 无 --</option>' + fields.map(f => `<option value="${f}">${f}</option>`).join('');
        if (fields.includes(yField)) ySel.value = yField;
    }
    if (cSel) {
        cSel.innerHTML = '<option value="">-- 无 --</option>' + fields.map(f => `<option value="${f}">${f}</option>`).join('');
        if (colorField) cSel.value = colorField;
    }
}

function selectChartType(type) {
    AppState.currentChartType = type;
    document.querySelectorAll('.chart-type-item').forEach(item => {
        item.classList.toggle('active', item.dataset.type === type);
    });
    updateChart();
}

function createChart(type) {
    navigateTo('editor');
    selectChartType(type);
}

function updateChart() {
    if (!AppState.currentData || AppState.currentData.length === 0) {
        showCanvasEmpty(true);
        return;
    }
    showCanvasEmpty(false);
    
    // 确保字段选择器是最新的（切换图表类型时保持正确映射）
    updateFieldSelectors();
    autoSelectFields();
    
    buildChartOptions();
    renderChart();
}

function showCanvasEmpty(show) {
    const empty = document.getElementById('canvasEmpty');
    const container = document.getElementById('canvasContainer');
    if (empty) empty.style.display = show ? 'flex' : 'none';
    if (container) container.classList.toggle('active', !show);
}

function buildChartOptions() {
    const data = AppState.currentData;
    const type = AppState.currentChartType;
    const xField = document.getElementById('xAxisField')?.value || '';
    const yField = document.getElementById('yAxisField')?.value || '';
    const colorScheme = document.getElementById('colorScheme')?.value || 'nature';
    const bgColor = document.getElementById('bgColor')?.value || '#ffffff';
    const fontFamily = document.getElementById('fontFamily')?.value || 'Noto Sans SC';
    const xAxisTitle = document.getElementById('xAxisTitle')?.value || xField;
    const yAxisTitle = document.getElementById('yAxisTitle')?.value || yField;
    const xAxisType = document.getElementById('xAxisType')?.value || 'category';
    const showGrid = document.getElementById('showGrid')?.checked ?? true;
    const showLegend = document.getElementById('showLegend')?.checked ?? true;
    const colors = AppState.colorSchemes[colorScheme] || AppState.colorSchemes.nature;
    const width = parseInt(document.getElementById('chartWidth')?.value) || 800;
    const height = parseInt(document.getElementById('chartHeight')?.value) || 500;
    
    const titleText = document.getElementById('chartTitle')?.value || '数据可视化图表';
    const titleFontSize = fontFamily === 'Noto Sans SC' ? 16 : 14;
    
    const baseOption = {
        backgroundColor: bgColor,
        title: {
            text: titleText,
            left: 'center',
            textStyle: { fontFamily, fontSize: titleFontSize, fontWeight: 600, color: '#1A1D23' }
        },
        tooltip: {
            trigger: type === 'pie' || type === 'sunburst' ? 'item' : 'axis',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: '#E2E8F0',
            borderWidth: 1,
            textStyle: { fontFamily, color: '#1A1D23' },
            axisPointer: { type: 'line', lineStyle: { color: '#2D6BE4', type: 'dashed' } }
        },
        legend: {
            show: showLegend && type !== 'pie' && type !== 'sunburst' && type !== 'treemap',
            bottom: 10,
            textStyle: { fontFamily, fontSize: 12, color: '#64748B' }
        },
        color: colors,
        grid: { left: 60, right: 40, top: 70, bottom: showLegend ? 60 : 40, containLabel: true },
        xAxis: {
            type: xAxisType,
            name: xAxisTitle,
            nameLocation: 'middle',
            nameGap: 35,
            nameTextStyle: { fontFamily, fontSize: 12, color: '#64748B' },
            axisLine: { lineStyle: { color: '#E2E8F0' } },
            axisTick: { lineStyle: { color: '#E2E8F0' } },
            axisLabel: { fontFamily, fontSize: 11, color: '#64748B', rotate: 0 },
            splitLine: { show: showGrid, lineStyle: { color: '#F1F5F9', type: 'dashed' } },
            data: []
        },
        yAxis: {
            type: 'value',
            name: yAxisTitle,
            nameLocation: 'middle',
            nameGap: 45,
            nameTextStyle: { fontFamily, fontSize: 12, color: '#64748B' },
            axisLine: { lineStyle: { color: '#E2E8F0' } },
            axisTick: { lineStyle: { color: '#E2E8F0' } },
            axisLabel: { fontFamily, fontSize: 11, color: '#64748B' },
            splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } }
        },
        series: []
    };
    
    // 根据图表类型生成选项
    if (type === 'line' || type === 'area') {
        baseOption.series = [{
            name: yField,
            type: 'line',
            data: data.map(r => r[yField]),
            smooth: true,
            areaStyle: type === 'area' ? { opacity: 0.2 } : undefined,
            lineStyle: { width: 2.5, color: colors[0] },
            itemStyle: { color: colors[0] },
            label: { show: false }
        }];
        baseOption.xAxis.data = data.map(r => r[xField]);
    } else if (type === 'bar' || type === 'horizontalBar') {
        if (type === 'horizontalBar') {
            baseOption.xAxis.type = 'value';
            baseOption.yAxis.type = 'category';
            baseOption.yAxis.data = data.map(r => r[xField]);
            baseOption.xAxis.name = yAxisTitle;
            baseOption.yAxis.name = xAxisTitle;
            delete baseOption.xAxis.splitLine;
        } else {
            baseOption.xAxis.data = data.map(r => r[xField]);
        }
        baseOption.series = [{
            name: type === 'horizontalBar' ? yField : yField,
            type: 'bar',
            data: data.map(r => r[yField]),
            itemStyle: { color: (p) => colors[p.dataIndex % colors.length] },
            barWidth: '55%',
            label: { 
                show: true, 
                position: 'top', 
                fontFamily,
                fontSize: 11, 
                color: '#64748B',
                formatter: (p) => typeof p.value === 'number' ? p.value.toLocaleString() : p.value
            }
        }];
        if (type === 'horizontalBar') baseOption.xAxis.splitLine = { lineStyle: { color: '#F1F5F9', type: 'dashed' } };
    } else if (type === 'pie') {
        delete baseOption.xAxis;
        delete baseOption.yAxis;
        delete baseOption.grid;
        baseOption.series = [{
            name: xField,
            type: 'pie',
            radius: ['35%', '65%'],
            data: data.map(r => ({ name: r[xField], value: r[yField] })),
            label: { fontFamily, formatter: '{b}: {d}%', fontSize: 12 },
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } }
        }];
        baseOption.tooltip.trigger = 'item';
        baseOption.tooltip.formatter = '{b}: {c} ({d}%)';
    } else if (type === 'scatter') {
        baseOption.series = [{
            name: yField,
            type: 'scatter',
            data: data.map(r => [r[xField], r[yField]]),
            symbolSize: 12,
            itemStyle: { color: colors[0], opacity: 0.75 }
        }];
        baseOption.xAxis.type = 'value';
        baseOption.yAxis.type = 'value';
    } else if (type === 'heatmap') {
        baseOption.xAxis.type = 'category';
        baseOption.yAxis.type = 'category';
        baseOption.xAxis.data = data.map(r => r[xField]);
        baseOption.yAxis.data = [yField];
        baseOption.visualMap = {
            min: Math.min(...data.map(r => r[yField])),
            max: Math.max(...data.map(r => r[yField])),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 10,
            inRange: { color: ['#E8F4FD', '#2D6BE4', '#00D4B4'] }
        };
        baseOption.series = [{
            name: yField,
            type: 'heatmap',
            data: data.map((r, i) => [i, 0, r[yField]]),
            label: { show: true, fontFamily, fontSize: 11, color: '#fff' },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } }
        }];
        baseOption.tooltip = { formatter: (p) => `${data[p.data[0]][xField]}: ${p.data[2]}` };
    } else if (type === 'radar') {
        delete baseOption.xAxis;
        delete baseOption.yAxis;
        delete baseOption.grid;
        const indicators = data.map(r => ({ name: r[xField], max: Math.max(...data.map(d => d[yField])) * 1.2 }));
        baseOption.radar = {
            indicator: indicators,
            radius: '65%',
            axisName: { fontFamily, fontSize: 11, color: '#64748B' },
            splitArea: { areaStyle: { color: ['rgba(45,107,228,0.04)', 'transparent'] } }
        };
        baseOption.series = [{
            name: yField,
            type: 'radar',
            data: [{ value: data.map(r => r[yField]), name: yField }],
            areaStyle: { opacity: 0.2 },
            lineStyle: { width: 2 }
        }];
    } else if (type === 'boxplot') {
        const boxData = prepareBoxplotData(data, xField, yField);
        baseOption.xAxis.data = boxData.categories;
        baseOption.series = [
            { name: '箱线图', type: 'boxplot', data: boxData.values },
            { name: '异常点', type: 'scatter', data: boxData.outliers }
        ];
    } else if (type === 'treemap') {
        delete baseOption.xAxis;
        delete baseOption.yAxis;
        delete baseOption.grid;
        baseOption.series = [{
            name: xField,
            type: 'treemap',
            data: data.map(r => ({ name: r[xField], value: r[yField] })),
            label: { show: true, formatter: '{b}', fontFamily, fontSize: 12 },
            breadcrumb: { show: false }
        }];
        baseOption.tooltip = { formatter: (p) => `${p.name}: ${p.value}` };
    } else if (type === 'sunburst') {
        delete baseOption.xAxis;
        delete baseOption.yAxis;
        delete baseOption.grid;
        baseOption.series = [{
            name: xField,
            type: 'sunburst',
            data: data.map(r => ({ name: r[xField], value: r[yField] })),
            label: { show: true, fontFamily, fontSize: 11, rotate: 'radial' }
        }];
        baseOption.tooltip = { formatter: (p) => `${p.name}: ${p.value}` };
    } else if (type === 'parallel') {
        const pFields = AppState.currentFields.filter(f => f !== xField);
        baseOption.parallelAxis = pFields.map((f, i) => ({
            dim: i, name: f, nameTextStyle: { fontFamily, fontSize: 11 },
            axisLine: { lineStyle: { color: '#E2E8F0' } }
        }));
        baseOption.parallel = { left: 60, right: 80, top: 70, bottom: 40 };
        baseOption.series = [{
            name: '数据',
            type: 'parallel',
            lineStyle: { width: 2, color: colors[0], opacity: 0.6 },
            data: data.map(r => pFields.map(f => r[f]))
        }];
    }
    
    AppState.chartOptions = baseOption;
    AppState.chartOptions._width = width;
    AppState.chartOptions._height = height;
}

function prepareBoxplotData(data, catField, valField) {
    const groups = {};
    data.forEach(r => {
        const cat = r[catField];
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(r[valField]);
    });
    const categories = Object.keys(groups);
    const values = categories.map(cat => calculateBoxplotStats(groups[cat]));
    const outliers = [];
    categories.forEach((cat, i) => {
        const [min, q1, med, q3, max] = values[i];
        groups[cat].forEach(v => {
            if (v < min || v > max) outliers.push([i, v]);
        });
    });
    return { categories, values, outliers };
}

function calculateBoxplotStats(arr) {
    if (!arr.length) return [0, 0, 0, 0, 0];
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = percentile(sorted, 25);
    const med = percentile(sorted, 50);
    const q3 = percentile(sorted, 75);
    const iqr = q3 - q1;
    const min = Math.max(sorted[0], q1 - 1.5 * iqr);
    const max = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
    return [min, q1, med, q3, max];
}

function percentile(sorted, p) {
    const idx = (p / 100) * (sorted.length - 1);
    const low = Math.floor(idx), high = Math.ceil(idx);
    return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
}

function renderChart() {
    const container = document.getElementById('mainChart');
    if (!container) return;
    const w = AppState.chartOptions._width || 800;
    const h = AppState.chartOptions._height || 500;
    container.style.width = w + 'px';
    container.style.height = h + 'px';
    
    if (!AppState.chartInstance) {
        AppState.chartInstance = echarts.init(container);
    }
    AppState.chartInstance.setOption(AppState.chartOptions, true);
    
    saveHistory();
}

// ==================== 图表缩略图 ====================
function renderThumbnails() {
    const thumbnails = [
        { id: 'thumb-gdp-trend', type: 'line', dataKey: 'economic_data', xField: '年份', yField: 'GDP总量_万亿元', title: 'GDP趋势' },
        { id: 'thumb-weather-heatmap', type: 'heatmap', dataKey: 'monthly_weather', xField: 'month', yField: 'avg_temperature_celsius', title: '气候' },
        { id: 'thumb-university-bar', type: 'bar', dataKey: 'university_rankings', xField: '学校名称', yField: '综合得分', title: '排名' },
        { id: 'thumb-retail-pie', type: 'pie', dataKey: 'retail_sales', xField: 'category', yField: 'sales_amount_万元', title: '占比' }
    ];
    
    thumbnails.forEach(t => {
        const el = document.getElementById(t.id);
        if (!el || !AppState.datasets?.[t.dataKey]) return;
        const chart = echarts.init(el);
        const data = AppState.datasets[t.dataKey];
        const opt = {
            backgroundColor: '#fff',
            title: { show: false },
            grid: { left: 5, right: 5, top: 5, bottom: 5 },
            xAxis: { show: false },
            yAxis: { show: false }
        };
        if (t.type === 'line') {
            opt.series = [{ type: 'line', data: data.map(r => r[t.yField]), smooth: true, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } }];
        } else if (t.type === 'heatmap') {
            opt.series = [{ type: 'heatmap', data: data.map((r, i) => [i, 0, r[t.yField]]), xAxisIndex: 0, yAxisIndex: 0 }];
            opt.xAxis = { type: 'category', show: false };
            opt.yAxis = { type: 'category', show: false };
        } else if (t.type === 'bar') {
            opt.series = [{ type: 'bar', data: data.map(r => r[t.yField]), showSymbol: false, barWidth: '50%' }];
        } else if (t.type === 'pie') {
            opt.series = [{ type: 'pie', radius: ['30%', '65%'], data: data.map(r => ({ name: r[t.xField], value: r[t.yField] })), label: { show: false } }];
        }
        chart.setOption(opt);
        setTimeout(() => chart.resize(), 50);
    });
}

// ==================== 图表保存/加载 ====================
async function saveChart() {
    if (!Auth.isLoggedIn()) {
        showLoginModal();
        showToast('请先登录后保存图表', 'warning');
        return;
    }
    
    if (!AppState.currentData || AppState.currentData.length === 0) {
        showToast('请先加载数据并创建图表', 'warning');
        return;
    }
    
    const title = document.getElementById('chartTitle')?.value || '未命名图表';
    const chart_type = AppState.currentChartType;
    const options = AppState.chartOptions;
    
    try {
        const data = await Auth.request('/api/charts', {
            method: 'POST',
            body: JSON.stringify({
                title,
                chart_type,
                options,
                dataset_id: AppState.currentDatasetId
            })
        });
        
        showToast(`图表已保存！ID: ${data.id}`, 'success');
        AppState.exportHistory++;
        document.getElementById('statExports').textContent = AppState.exportHistory;
        loadUserCharts();
    } catch (err) {
        showToast('保存失败：' + err.message, 'error');
    }
}

async function loadUserCharts(filter = 'all') {
    if (!Auth.isLoggedIn()) return;
    
    try {
        const charts = await Auth.request('/api/charts');
        AppState.userCharts = charts;
        
        document.getElementById('statCharts').textContent = charts.length;
        
        const container = document.getElementById('recentProjects');
        if (!charts || charts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-text">还没有图表，开始创建吧！</div>
                    <button class="btn btn-primary btn-sm" onclick="navigateTo('editor')">创建第一个图表</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = charts.slice(0, 6).map(chart => `
            <div class="project-item" onclick="loadChart(${chart.id})">
                <div class="project-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;">
                    ${getChartIcon(chart.chart_type)}
                </div>
                <div class="project-info">
                    <div class="project-name">${chart.title}</div>
                    <div class="project-meta">${chart.chart_type} · ${formatDate(chart.updated_at)}</div>
                </div>
                <div class="project-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteChart(${chart.id})" title="删除">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('加载图表失败:', err);
    }
}

async function loadChart(id) {
    try {
        showToast('正在加载图表...', 'info');
        const chart = await Auth.request(`/api/charts/${id}`);
        
        AppState.currentChartType = chart.chart_type || 'line';
        AppState.chartOptions = chart.options || {};
        AppState.currentDatasetId = chart.dataset_id;
        
        // 更新UI
        document.getElementById('chartTitle').value = chart.title;
        selectChartType(AppState.currentChartType);
        
        // 如果有数据集，加载数据集
        if (chart.dataset_id) {
            await loadUserDataset(chart.dataset_id);
        }
        
        // 渲染图表
        showCanvasEmpty(false);
        buildChartOptions();
        renderChart();
        
        navigateTo('editor');
        showToast('图表加载成功', 'success');
    } catch (err) {
        showToast('加载失败：' + err.message, 'error');
    }
}

async function deleteChart(id) {
    if (!confirm('确定要删除这个图表吗？')) return;
    
    try {
        await Auth.request(`/api/charts/${id}`, { method: 'DELETE' });
        showToast('图表已删除', 'success');
        loadUserCharts();
    } catch (err) {
        showToast('删除失败：' + err.message, 'error');
    }
}

// ==================== 分享功能 ====================
async function shareChart() {
    if (!Auth.isLoggedIn()) {
        showLoginModal();
        showToast('请先登录后分享图表', 'warning');
        return;
    }
    
    if (!AppState.chartOptions || Object.keys(AppState.chartOptions).length === 0) {
        showToast('请先创建图表后再分享', 'warning');
        return;
    }
    
    // 先保存图表
    const title = document.getElementById('chartTitle')?.value || '未命名图表';
    const chart_type = AppState.currentChartType;
    const options = AppState.chartOptions;
    
    try {
        const data = await Auth.request('/api/charts', {
            method: 'POST',
            body: JSON.stringify({
                title,
                chart_type,
                options,
                dataset_id: AppState.currentDatasetId
            })
        });
        
        // 生成分享链接
        const shareData = await Auth.request(`/api/charts/${data.id}/share`, {
            method: 'POST'
        });
        
        // 显示分享模态框
        document.getElementById('shareLoading').style.display = 'none';
        document.getElementById('shareSuccess').style.display = 'block';
        document.getElementById('shareError').style.display = 'none';
        document.getElementById('shareUrl').value = window.location.origin + '/share/' + shareData.share_id;
        document.getElementById('shareModal').style.display = 'flex';
        
        showToast('图表已保存，正在生成分享链接...', 'success');
    } catch (err) {
        document.getElementById('shareLoading').style.display = 'none';
        document.getElementById('shareError').style.display = 'block';
        document.getElementById('shareError').textContent = err.message;
        showToast('分享失败：' + err.message, 'error');
    }
}

function copyShareUrl() {
    const url = document.getElementById('shareUrl').value;
    navigator.clipboard.writeText(url).then(() => {
        showToast('分享链接已复制到剪贴板！', 'success');
    }).catch(() => {
        document.getElementById('shareUrl').select();
        document.execCommand('copy');
        showToast('分享链接已复制！', 'success');
    });
}

// ==================== AI 分析 ====================
function runAIAnalysis() {
    const recommend = document.getElementById('aiRecommend');
    if (!recommend) return;
    
    // 移除旧的加载状态
    const oldLoading = recommend.querySelector('.ai-loading');
    if (oldLoading) oldLoading.remove();
    
    if (!AppState.currentData || AppState.currentData.length === 0) {
        recommend.innerHTML = '<div class="ai-hint">加载数据后，我将为您推荐最佳图表类型</div>';
        return;
    }
    
    const data = AppState.currentData;
    const fields = AppState.currentFields;
    const numericCount = fields.filter(f => data.some(r => typeof r[f] === 'number')).length;
    const rowCount = data.length;
    let suggestions = [];
        
        if (numericCount >= 2) {
            suggestions.push('📈 折线图 — 适合展示趋势变化');
        }
        if (numericCount >= 1 && fields.length >= 1) {
            suggestions.push('📊 柱状图 — 适合分类对比');
        }
        if (rowCount <= 10 && numericCount >= 1) {
            suggestions.push('🥧 饼图 — 适合展示占比分布');
        }
        if (numericCount >= 2) {
            suggestions.push('✨ 散点图 — 适合相关性分析');
        }
        if (numericCount >= 3) {
            suggestions.push('🕸️ 雷达图 — 适合多维指标对比');
            suggestions.push('📦 箱线图 — 适合统计分布分析');
        }
        if (suggestions.length === 0) {
            suggestions.push('📊 柱状图 — 最通用的图表选择');
        }
        
        recommend.innerHTML = suggestions.slice(0, 3).map(s => 
            `<div class="ai-suggestion" onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.background='transparent');this.style.background='rgba(45,107,228,0.1');this.style.borderRadius='6px';this.style.padding='6px 8px'">${s}</div>`
        ).join('');
}

function toggleAIPanel() {
    const panel = document.getElementById('aiPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function handleAIInput(e) {
    if (e.key === 'Enter') sendAIMessage();
}

function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const msg = input.value.trim();
    if (!msg) return;
    
    const messages = document.getElementById('aiMessages');
    messages.innerHTML += `<div class="ai-message ai-message-user"><div class="ai-avatar">👤</div><div class="ai-content">${msg}</div></div>`;
    input.value = '';
    
    setTimeout(() => {
        const reply = generateAIReply(msg);
        messages.innerHTML += `<div class="ai-message ai-message-bot"><div class="ai-avatar">🤖</div><div class="ai-content">${reply}</div></div>`;
        messages.scrollTop = messages.scrollHeight;
    }, 600);
}

function generateAIReply(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('配色') || lower.includes('颜色')) {
        return '建议使用 Nature 学术配色（蓝青红橙），适合大多数学术场景。如果需要黑白打印，切换到"黑白打印友好"配色方案。';
    }
    if ((lower.includes('图') || lower.includes('推荐')) && (lower.includes('建议') || lower.includes('什么'))) {
        return '根据你的数据特征，我推荐使用：<br>1️⃣ 折线图 — 展示趋势<br>2️⃣ 柱状图 — 分类对比<br>3️⃣ 散点图 — 相关性分析';
    }
    if (lower.includes('导出') || lower.includes('格式')) {
        return '学术投稿推荐导出 SVG 或 PDF 格式（矢量图），可确保 300dpi 清晰度。论文插图建议使用 PNG 300dpi。';
    }
    if (lower.includes('异常') || lower.includes('离群')) {
        return '可以使用箱线图来检测异常值。箱线图显示数据的 Q1、Q3、中位数和须线范围，超出须线的点即为潜在异常值。';
    }
    if (lower.includes('分享') || lower.includes('链接')) {
        return '点击编辑器中的"分享"按钮，系统会为你的图表生成一个链接，复制后可以发送给任何人查看，无需登录账号。';
    }
    if (lower.includes('保存') || lower.includes('存储')) {
        return '创建图表后点击"保存"按钮，图表会保存在你的账号中。换设备或换浏览器登录后，数据和图表都不会丢失。';
    }
    return '我能帮你：<br>• 推荐最佳图表类型<br>• 优化配色方案<br>• 解释图表数据<br>• 导出学术格式建议<br>• 分享图表给其他人<br><br>请告诉我你需要什么帮助？';
}

// ==================== 导出功能 ====================
function initExportOptions() {
    // 格式选项
    document.querySelectorAll('#formatOptions .format-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.format-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });
    
    // 分辨率选项
    document.querySelectorAll('#resolutionOptions .resolution-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.resolution-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });
    
    // 背景选项
    document.querySelectorAll('#bgOptions .bg-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.bg-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });
}

function showExportPanel() {
    navigateTo('export');
}

function renderExportPreview() {
    const container = document.getElementById('exportChartContainer');
    if (!container) return;
    
    if (!AppState.chartInstance || Object.keys(AppState.chartOptions).length === 0) {
        container.innerHTML = '<div class="empty-icon">📊</div><div class="empty-text">请先在编辑器中创建图表</div>';
        return;
    }
    
    container.innerHTML = '';
    const clone = document.createElement('div');
    clone.id = 'exportChartClone';
    clone.style.width = '100%';
    clone.style.height = '300px';
    container.appendChild(clone);
    
    const chart = echarts.init(clone);
    chart.setOption(AppState.chartOptions, true);
    setTimeout(() => chart.resize(), 100);
}

function applyJournalPreset() {
    const preset = document.getElementById('journalPreset')?.value;
    if (!preset || !AppState.journalPresets[preset]) return;
    const p = AppState.journalPresets[preset];
    document.getElementById('exportWidth').value = Math.round(p.width * 3.78);
    document.getElementById('exportHeight').value = Math.round(p.height * 3.78);
    document.getElementById('journalPreset').style.borderColor = 'var(--primary)';
    showToast(`已应用 ${preset.toUpperCase()} 期刊规范`, 'success');
}

function doExport() {
    if (!AppState.chartInstance || Object.keys(AppState.chartOptions).length === 0) {
        showToast('请先在编辑器中创建图表', 'warning');
        return;
    }
    
    const format = document.querySelector('input[name="format"]:checked')?.value || 'png';
    const modal = document.getElementById('exportModal');
    const body = document.getElementById('exportModalBody');
    body.innerHTML = `
        <p>确认导出设置：</p>
        <ul style="margin-top:12px;font-size:0.9rem;color:var(--text-secondary);line-height:2">
            <li>格式：<strong>${format.toUpperCase()}</strong></li>
            <li>DPI：<strong>${document.querySelector('input[name="dpi"]:checked')?.value || 300}</strong></li>
            <li>尺寸：<strong>${document.getElementById('exportWidth')?.value} × ${document.getElementById('exportHeight')?.value} px</strong></li>
        </ul>
    `;
    modal.style.display = 'flex';
}

function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

function confirmExport() {
    closeExportModal();
    const format = document.querySelector('input[name="format"]:checked')?.value || 'png';
    
    if (format === 'python' || format === 'r') {
        generateCodeExport(format);
        return;
    }
    
    if (!AppState.chartInstance) {
        showToast('请先在编辑器中创建图表', 'error');
        return;
    }
    
    const dpi = parseInt(document.querySelector('input[name="dpi"]:checked')?.value) || 300;
    const scale = dpi / 72;
    
    let mimeType = 'image/png';
    let ext = 'png';
    if (format === 'jpeg') { mimeType = 'image/jpeg'; ext = 'jpg'; }
    
    const bgValue = document.querySelector('input[name="bg"]:checked')?.value || 'white';
    let bgColor = '#ffffff';
    if (bgValue === 'dark') bgColor = '#1A1D23';
    else if (bgValue === 'transparent') bgColor = 'transparent';
    
    const url = AppState.chartInstance.getDataURL({
        type: mimeType,
        pixelRatio: scale,
        backgroundColor: bgColor,
        excludeComponents: ['toolbox']
    });
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataviz_${Date.now()}.${ext}`;
    a.click();
    
    AppState.exportHistory++;
    document.getElementById('statExports').textContent = AppState.exportHistory;
    showToast('导出成功！', 'success');
}

function generateCodeExport(format) {
    const data = AppState.currentData || [];
    const xField = document.getElementById('xAxisField')?.value || '';
    const yField = document.getElementById('yAxisField')?.value || '';
    const type = AppState.currentChartType;
    const title = document.getElementById('chartTitle')?.value || '数据可视化';
    
    let code = '';
    if (format === 'python') {
        code = `import matplotlib.pyplot as plt
import numpy as np

# 数据
x = ${JSON.stringify(data.map(r => r[xField]))}
y = ${JSON.stringify(data.map(r => r[yField]))}

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['Noto Sans SC', 'SimHei', 'Source Han Sans CN']
plt.rcParams['axes.unicode_minus'] = False

# 创建图表
fig, ax = plt.subplots(figsize=(10, 6))
ax.set_title('${title}', fontsize=16)
ax.set_xlabel('${xField}')
ax.set_ylabel('${yField}')

# 根据图表类型选择绘制方式
${type === 'line' ? "ax.plot(x, y, marker='o', linewidth=2, markersize=6)" : ''}
${type === 'bar' ? "ax.bar(x, y, color='#2D6BE4', width=0.6)" : ''}
${type === 'scatter' ? "ax.scatter(x, y, s=100, alpha=0.6)" : ''}
${type === 'pie' ? "ax.pie(y, labels=x, autopct='%1.1f%%')" : ''}

plt.tight_layout()
plt.savefig('chart.png', dpi=300, bbox_inches='tight')
plt.show()
print("图表已保存为 chart.png")
`;
    } else if (format === 'r') {
        code = `# R语言可视化代码
# 使用 ggplot2 包

# 安装包（如果未安装）
# install.packages("ggplot2")

library(ggplot2)

# 创建数据框
df <- data.frame(
  ${xField} = c(${data.map(r => `"${r[xField]}"`).join(', ')}),
  ${yField} = c(${data.map(r => r[yField]).join(', ')})
)

# 创建图表
p <- ggplot(df, aes(x = ${xField}, y = ${yField})) +
  ggtitle("${title}") +
  xlab("${xField}") +
  ylab("${yField}") +
  theme_bw()

# 根据图表类型添加图层
${type === 'line' ? "p <- p + geom_line(color='#2D6BE4', linewidth=1) + geom_point(color='#2D6BE4', size=3)" : ''}
${type === 'bar' ? "p <- p + geom_bar(stat='identity', fill='#2D6BE4', width=0.6)" : ''}
${type === 'scatter' ? "p <- p + geom_point(size=4, alpha=0.6)" : ''}

# 保存图表
ggsave("chart.png", plot = p, dpi = 300, width = 10, height = 6)
cat("图表已保存为 chart.png\\n")
`;
    }
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataviz_${format}_code.${format === 'python' ? 'py' : 'R'}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${format === 'python' ? 'Python' : 'R'} 代码已导出！`, 'success');
}

// ==================== 历史记录 ====================
function saveHistory() {
    if (AppState.historyIndex < AppState.history.length - 1) {
        AppState.history = AppState.history.slice(0, AppState.historyIndex + 1);
    }
    AppState.history.push(JSON.stringify(AppState.chartOptions));
    AppState.historyIndex = AppState.history.length - 1;
}

function undoAction() {
    if (AppState.historyIndex > 0) {
        AppState.historyIndex--;
        AppState.chartInstance.setOption(JSON.parse(AppState.history[AppState.historyIndex]), true);
        showToast('已撤销', 'info');
    } else {
        showToast('没有可撤销的操作', 'info');
    }
}

function redoAction() {
    if (AppState.historyIndex < AppState.history.length - 1) {
        AppState.historyIndex++;
        AppState.chartInstance.setOption(JSON.parse(AppState.history[AppState.historyIndex]), true);
        showToast('已重做', 'info');
    } else {
        showToast('没有可重做的操作', 'info');
    }
}

// ==================== 尺寸预设 ====================
function setSizePreset(preset) {
    const sizes = {
        small: [600, 400],
        medium: [800, 500],
        large: [1000, 600],
        paper: [760, 510]
    };
    const [w, h] = sizes[preset] || [800, 500];
    document.getElementById('chartWidth').value = w;
    document.getElementById('chartHeight').value = h;
    document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    updateChart();
}

// ==================== 模板 ====================
function applyJournalTemplate(preset) {
    navigateTo('editor');
    const p = AppState.journalPresets[preset];
    if (p) {
        document.getElementById('chartWidth').value = Math.round(p.width * 3.78);
        document.getElementById('chartHeight').value = Math.round(p.height * 3.78);
        document.getElementById('colorScheme').value = preset === 'nature' || preset === 'science' ? 'bw' : 'nature';
        if (p.font) {
            const fontMap = { 'Arial': 'Arial', 'Times New Roman': 'Times New Roman' };
            if (fontMap[p.font]) document.getElementById('fontFamily').value = fontMap[p.font];
        }
        showToast(`已应用 ${preset.toUpperCase()} 学术模板`, 'success');
        setTimeout(() => updateChart(), 100);
    }
}

function applyTemplate(name) {
    navigateTo('editor');
    showToast(`已应用 ${name} 模板`, 'success');
}

// ==================== 数据清洗 ====================
function cleanData(action) {
    if (!AppState.currentData) {
        showToast('请先加载数据', 'warning');
        return;
    }
    const log = document.getElementById('cleaningLog');
    document.getElementById('dataCleaning').style.display = 'block';
    let msg = '';
    if (action === 'dedup') {
        const before = AppState.currentData.length;
        const seen = new Set();
        AppState.currentData = AppState.currentData.filter(r => {
            const key = JSON.stringify(r);
            if (seen.has(key)) return false;
            seen.add(key); return true;
        });
        msg = `✅ 去重完成：删除了 ${before - AppState.currentData.length} 条重复记录`;
    } else if (action === 'fillna') {
        let filled = 0;
        AppState.currentFields.forEach(f => {
            const nums = AppState.currentData.filter(r => typeof r[f] === 'number' && r[f] !== null && r[f] !== undefined && r[f] !== '');
            if (nums.length > 0) {
                const avg = nums.reduce((s, r) => s + r[f], 0) / nums.length;
                AppState.currentData.forEach(r => {
                    if (r[f] === null || r[f] === undefined || r[f] === '') { r[f] = Math.round(avg * 100) / 100; filled++; }
                });
            }
        });
        msg = `✅ 填补缺失值完成：填充了 ${filled} 个空值（使用均值）`;
    } else if (action === 'type') {
        AppState.currentFields.forEach(f => {
            const vals = AppState.currentData.map(r => r[f]);
            const nums = vals.filter(v => !isNaN(parseFloat(v)) && v !== '');
            if (nums.length > vals.length * 0.5) {
                AppState.currentData.forEach(r => {
                    const v = r[f];
                    if (v !== '' && v !== null && v !== undefined) r[f] = parseFloat(v);
                });
            }
        });
        msg = '✅ 类型转换完成：已自动识别并转换数值字段';
    } else if (action === 'normalize') {
        AppState.currentFields.forEach(f => {
            const nums = AppState.currentData.map(r => r[f]).filter(v => typeof v === 'number');
            if (nums.length > 2) {
                const min = Math.min(...nums), max = Math.max(...nums), range = max - min;
                if (range > 0) {
                    AppState.currentData.forEach(r => {
                        if (typeof r[f] === 'number') r[f] = Math.round(((r[f] - min) / range) * 100) / 100;
                    });
                }
            }
        });
        msg = '✅ 数据标准化完成：所有数值字段已归一化到 [0, 1]';
    } else if (action === 'filter') {
        msg = '💡 提示：使用图表类型选择器或数据映射来筛选和展示数据';
    }
    log.innerHTML = msg;
    showDataPreview(AppState.currentData);
    updateChart();
    showToast(msg, 'success');
}

// ==================== 文件上传 ====================
function initUpload() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectFileBtn');
    
    if (!dropzone || !fileInput) return;
    
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processUploadedFile(file);
    });
    
    selectBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) processUploadedFile(file);
    });
}

async function processUploadedFile(file) {
    if (!Auth.isLoggedIn()) {
        showLoginModal();
        showToast('请先登录后上传数据', 'warning');
        return;
    }
    
    const progressArea = document.getElementById('uploadProgress');
    const dropzone = document.getElementById('dropzone');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const filename = document.getElementById('progressFilename');
    const status = document.getElementById('progressStatus');
    
    dropzone.style.display = 'none';
    progressArea.style.display = 'flex';
    filename.textContent = file.name;
    status.textContent = '上传中...';
    
    // 模拟进度
    let pct = 0;
    const interval = setInterval(() => {
        pct += Math.random() * 20;
        if (pct > 90) pct = 90;
        const offset = 283 - (283 * pct / 100);
        progressBar.style.strokeDashoffset = offset;
        progressText.textContent = Math.round(pct) + '%';
    }, 200);
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        
        const result = await Auth.request('/api/datasets', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(interval);
        progressBar.style.strokeDashoffset = 0;
        progressText.textContent = '100%';
        status.textContent = '上传完成！正在解析...';
        
        // 加载上传的数据
        await loadUserDataset(result.id);
        loadUserDatasets();
        
        setTimeout(() => {
            progressArea.style.display = 'none';
            dropzone.style.display = 'block';
            showToast(`成功上传并加载：${file.name}`, 'success');
        }, 500);
    } catch (e) {
        clearInterval(interval);
        progressArea.style.display = 'none';
        dropzone.style.display = 'block';
        showToast('上传失败：' + e.message, 'error');
    }
}

function cancelUpload() {
    document.getElementById('uploadProgress').style.display = 'none';
    document.getElementById('dropzone').style.display = 'block';
}

// ==================== Toast 提示 ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${message}<span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ==================== 统计卡片 ====================
function updateStatCards() {
    document.getElementById('statDatasets').textContent = AppState.userDatasets?.length || 0;
    document.getElementById('statCharts').textContent = AppState.userCharts?.length || 0;
    document.getElementById('statExports').textContent = AppState.exportHistory;
    document.getElementById('statFavorites').textContent = AppState.favorites?.length || 0;
}

// ==================== 帮助和设置 ====================
function showHelp() {
    document.getElementById('helpModal').style.display = 'flex';
}

function showSettings() {
    const user = Auth.getUser();
    if (!user) {
        showLoginModal();
        return;
    }
    showToast(`当前用户：${user.username} (${user.email})，功能开发中...`, 'info');
}

// ==================== 辅助函数 ====================
function getChartIcon(type) {
    const icons = {
        line: '📈',
        bar: '📊',
        horizontalBar: '📉',
        pie: '🥧',
        scatter: '✨',
        area: '📶',
        heatmap: '🟨',
        radar: '🕸️',
        boxplot: '📦',
        treemap: '🌲',
        sunburst: '☀️',
        parallel: '⿻'
    };
    return icons[type] || '📊';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    
    return date.toLocaleDateString('zh-CN');
}

// 数据集存储（用于示例数据）
AppState.datasets = {};

// ==================== 侧边栏交互 ====================
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
});
