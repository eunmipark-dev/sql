import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupNativeShell } from './lib/native'
import './style.css'

createApp(App).use(createPinia()).use(router).mount('#app')
setupNativeShell(router)
