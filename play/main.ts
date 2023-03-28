import { createApp } from 'vue'
import '@element-plus/theme-chalk/src/dark/css-vars.scss'
;(async () => {
  const apps = import.meta.glob('./src/*.vue')
  // const apps = import.meta.globEager('./src/*.vue')
  console.log('apps', apps, import.meta)

  const name = location.pathname.replace(/^\//, '') || 'App'
  const file = apps[`./src/${name}.vue`]
  if (!file) {
    location.pathname = 'App'
    return
  }
  const App = (await file()).default
  // const App = file.default
  console.log('App', App)

  const app = createApp(App, { a: 1 })

  app.mount('#play')
})()
