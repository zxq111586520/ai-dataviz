/**
 * 认证工具模块
 * 处理用户登录、注册、Token管理
 */

const Auth = {
  // API基础URL
  API_URL: '/api',
  
  // 获取存储的token
  getToken() {
    return localStorage.getItem('dataviz_token');
  },
  
  // 获取当前用户信息
  getUser() {
    const userStr = localStorage.getItem('dataviz_user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  // 检查是否已登录
  isLoggedIn() {
    return !!this.getToken();
  },
  
  // 设置认证信息
  setAuth(token, user) {
    localStorage.setItem('dataviz_token', token);
    localStorage.setItem('dataviz_user', JSON.stringify(user));
  },
  
  // 清除认证信息
  clearAuth() {
    localStorage.removeItem('dataviz_token');
    localStorage.removeItem('dataviz_user');
  },
  
  // 通用API请求
  async request(url, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };
    
    // 如果body不是FormData，且没有设置Content-Type，默认application/json
    // 如果是FormData，不设置Content-Type，让浏览器自动加上boundary
    if (!(options.body instanceof FormData)) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 处理body：如果不是FormData也不是字符串且有值，序列化为JSON
    let body = options.body;
    if (body instanceof FormData) {
      // FormData不处理，fetch会自动处理
    } else if (typeof body === 'string') {
      // 字符串不处理
    } else if (body && typeof body === 'object') {
      body = JSON.stringify(body);
    }
    
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: body,
        credentials: 'same-origin'
      });
      
      // 解析JSON响应
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      // Token过期
      if (response.status === 401) {
        const errMsg = typeof data === 'object' ? (data.error || '登录无效') : '登录无效';
        if (errMsg.includes('过期') || errMsg.includes('登录')) {
          this.clearAuth();
          window.location.reload();
          throw new Error('登录已过期，请重新登录');
        }
        throw new Error(errMsg);
      }
      
      if (!response.ok) {
        const errMsg = typeof data === 'object' ? (data.error || '请求失败') : data;
        throw new Error(errMsg);
      }
      
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('网络错误，请检查服务器是否运行');
      }
      throw err;
    }
  },
  
  // 注册
  async register(username, email, password) {
    const data = await this.request(`${this.API_URL}/auth/register`, {
      method: 'POST',
      body: { username, email, password }
    });
    this.setAuth(data.token, data.user);
    return data;
  },
  
  // 登录
  async login(username, password) {
    const data = await this.request(`${this.API_URL}/auth/login`, {
      method: 'POST',
      body: { username, password }
    });
    this.setAuth(data.token, data.user);
    return data;
  },
  
  // 验证Token
  async verify() {
    const data = await this.request(`${this.API_URL}/auth/verify`);
    return data.user;
  },
  
  // 获取当前用户
  async getMe() {
    const data = await this.request(`${this.API_URL}/auth/me`);
    return data.user;
  },
  
  // 登出
  logout() {
    this.clearAuth();
    window.location.reload();
  }
};

// 导出供全局使用
window.Auth = Auth;
