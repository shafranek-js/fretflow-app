
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    // Add this 'base' property for GitHub Pages
    base: '/fretflow-app/',
    
    server: {
      // This allows the app to work on different local URLs if needed
      cors: true 
    },
  }
})
