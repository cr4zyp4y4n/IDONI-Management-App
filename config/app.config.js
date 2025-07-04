// Configuración centralizada de la aplicación IDONI
module.exports = {
  // Configuración de la aplicación
  app: {
    name: 'IDONI App',
    version: '2.0.0',
    description: 'Aplicación de gestión de Excel y fichas técnicas de cocina',
    author: 'IDONI Project'
  },

  // Configuración de ventanas
  windows: {
    main: {
      width: 800,
      height: 600,
      title: 'IDONI App - Menú Principal',
      resizable: true,
      minimizable: true,
      maximizable: true
    },
    excel: {
      width: 1400,
      height: 900,
      title: 'IDONI App - Gestor de Excel',
      resizable: true,
      minimizable: true,
      maximizable: true
    },
    recipe: {
      width: 1200,
      height: 800,
      title: 'IDONI App - Fichas Técnicas',
      resizable: true,
      minimizable: true,
      maximizable: true
    }
  },

  // Rutas de archivos
  paths: {
    mainMenu: 'MainMenu/main-menu.html',
    excelManager: 'GestionExcel/excel-manager.html',
    recipeCards: 'FichaTecnica/recipe-cards.html',
    assets: 'assets',
    fonts: 'fonts'
  },

  // Configuración de archivos
  files: {
    supportedFormats: {
      excel: ['xlsx', 'xls'],
      export: ['html', 'pdf', 'json']
    },
    defaultNames: {
      recipe: 'Ficha_Tecnica',
      excel: 'Datos_Productos'
    }
  },

  // Configuración de desarrollo
  development: {
    devTools: process.argv.includes('--dev'),
    hotReload: false
  }
}; 