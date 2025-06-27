// 在应用启动时设置全局变量，解决 "self is not defined" 错误
export async function register() {
  // 确保在服务器端 self 被正确定义
  if (typeof global !== 'undefined') {
    if (typeof (global as any).self === 'undefined') {
      (global as any).self = global;
    }
    if (typeof (global as any).window === 'undefined') {
      (global as any).window = {};
    }
    if (typeof (global as any).document === 'undefined') {
      (global as any).document = {
        createElement: () => ({
          tagName: 'DIV',
          style: {},
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false,
            toggle: () => false
          },
          setAttribute: () => {},
          getAttribute: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
          appendChild: () => {},
          removeChild: () => {},
          innerHTML: '',
          textContent: ''
        }),
        getElementById: () => null,
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        createTextNode: (text: string) => ({ textContent: text }),
        body: {
          style: {},
          appendChild: () => {},
          removeChild: () => {},
          addEventListener: () => {},
          removeEventListener: () => {}
        },
        head: {
          appendChild: () => {},
          removeChild: () => {}
        },
        documentElement: {
          style: {},
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false,
            toggle: () => false
          },
          getAttribute: (name: string) => {
            if (name === 'data-theme') return 'light';
            if (name === 'lang') return 'zh';
            if (name === 'dir') return 'ltr';
            return null;
          },
          setAttribute: () => {},
          removeAttribute: () => {},
          hasAttribute: () => false,
          addEventListener: () => {},
          removeEventListener: () => {},
          appendChild: () => {},
          removeChild: () => {},
          innerHTML: '',
          textContent: '',
          tagName: 'HTML',
          nodeName: 'HTML',
          nodeType: 1
        }
      };
    }
    if (typeof (global as any).navigator === 'undefined') {
      (global as any).navigator = { userAgent: 'node' };
    }
    
    // 添加 location 对象
    if (typeof (global as any).location === 'undefined') {
      (global as any).location = {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/',
        search: '',
        hash: ''
      };
    }
    
    // 添加其他必要的浏览器 API
    if (typeof (global as any).localStorage === 'undefined') {
      (global as any).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      };
    }
    
    if (typeof (global as any).sessionStorage === 'undefined') {
      (global as any).sessionStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      };
    }
    
    // 添加 requestAnimationFrame 和 cancelAnimationFrame
    if (typeof (global as any).requestAnimationFrame === 'undefined') {
      (global as any).requestAnimationFrame = (callback: FrameRequestCallback): number => {
        return setTimeout(callback, 16) as unknown as number;
      };
    }
    
    if (typeof (global as any).cancelAnimationFrame === 'undefined') {
      (global as any).cancelAnimationFrame = (id: number) => {
        clearTimeout(id);
      };
    }
  }
}
