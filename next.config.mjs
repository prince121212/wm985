// 立即设置全局变量，解决 "self is not defined" 和 "window.addEventListener is not a function" 错误
// 这必须在任何其他导入之前执行
if (typeof global !== 'undefined') {
  try {
    // 强制设置 self
    global.self = global;

    // 创建完整的 window 对象，包含所有必要的方法
    global.window = {
      ...global,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; },
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
      setInterval: global.setInterval,
      clearInterval: global.clearInterval,
      requestAnimationFrame: function(callback) {
        return setTimeout(callback, 16);
      },
      cancelAnimationFrame: function(id) {
        clearTimeout(id);
      },
      location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      navigator: {
        userAgent: 'node',
        platform: 'node'
      },
      document: {
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
        createTextNode: (text) => ({ textContent: text }),
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
          getAttribute: (name) => {
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
      }
    };

    // 确保 document 也在全局作用域中
    global.document = global.window.document;

  } catch (e) {
    // 忽略只读属性错误
    console.warn('无法设置全局变量:', e.message);
  }
}

import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import mdx from "@next/mdx";
import { fileURLToPath } from 'url';
import path from 'path';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin();

const withMDX = mdx({
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // 性能优化配置
  poweredByHeader: false,
  compress: true,

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30天缓存
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 实验性功能 - 暂时禁用以解决构建问题
  experimental: {
    // 暂时禁用所有实验性功能
  },
  webpack: (config, { isServer, dev, webpack }) => {
    // 简化的 webpack 配置，专注于解决 self 问题
    if (isServer) {
      // 在服务器端设置全局变量
      if (typeof global !== 'undefined') {
        global.self = global;

        // 创建一个更完整的 window 对象
        global.window = {
          ...global,
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return true; },
          setTimeout: global.setTimeout,
          clearTimeout: global.clearTimeout,
          setInterval: global.setInterval,
          clearInterval: global.clearInterval,
          requestAnimationFrame: function(callback) {
            return setTimeout(callback, 16);
          },
          cancelAnimationFrame: function(id) {
            clearTimeout(id);
          },
          location: {
            href: 'http://localhost:3000',
            origin: 'http://localhost:3000',
            protocol: 'http:',
            host: 'localhost:3000',
            hostname: 'localhost',
            port: '3000',
            pathname: '/',
            search: '',
            hash: ''
          },
          navigator: {
            userAgent: 'node',
            platform: 'node'
          },
          document: {
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
            createTextNode: (text) => ({ textContent: text }),
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
              getAttribute: (name) => {
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
          }
        };
      }

      // 使用 DefinePlugin 来定义全局变量
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.DefinePlugin({
          'self': 'global',
          'window': 'global'
        })
      );

      // 在服务器端排除浏览器特有的包
      config.externals = config.externals || [];
      config.externals.push(
        'canvas-confetti',
        'google-one-tap',
        'react-icon-cloud',
        '@uiw/react-md-editor',
        'embla-carousel-auto-scroll',
        'embla-carousel-fade',
        'embla-carousel-react',
        'vaul',
        'framer-motion',
        'react-tweet'
      );
    }

    if (!isServer) {
      // 在客户端构建中排除 Node.js 模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
        path: false,
        child_process: false,
        nodemailer: false,
      };

      // 排除 nodemailer 包
      config.externals = config.externals || [];
      config.externals.push('nodemailer');
    }

    return config;
  },
  async redirects() {
    return [];
  },
};

// Make sure experimental mdx flag is enabled
const configWithMDX = {
  ...nextConfig,
  experimental: {
    ...nextConfig.experimental,
    mdxRs: true,
  },
};

export default withBundleAnalyzer(withNextIntl(withMDX(configWithMDX)));
