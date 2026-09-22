import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.career.explore',
  appName: '职业探索',
  webDir: 'dist',
  plugins: {
    // 用原生 HTTP 代替 WebView 的 fetch。
    // 原因：信息雷达要从远程拉 feed（VITE_INFO_FEED_URL），而多数静态托管
    // 不会给跨域请求带上 CORS 头，WebView 里直接 fetch 会被拦。
    // 走原生请求没有同源限制，任意 https 静态地址都能拉。
    // 目前只有信息雷达用网络，不影响其他页面（其余数据全在本地）。
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
