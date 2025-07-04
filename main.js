const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let excelWindow;
let recipeWindow;



function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'IDONI App - Menú Principal',
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  mainWindow.loadFile('MainMenu/main-menu.html');

  // Abrir DevTools en desarrollo
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createExcelWindow() {
  if (excelWindow) {
    excelWindow.focus();
    return;
  }

  excelWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'IDONI App - Gestor de Excel',
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  excelWindow.loadFile('GestionExcel/excel-manager.html');

  // Abrir DevTools en desarrollo
  if (process.argv.includes('--dev')) {
    excelWindow.webContents.openDevTools();
  }

  excelWindow.on('closed', () => {
    excelWindow = null;
  });
}

function createRecipeWindow() {
  if (recipeWindow) {
    recipeWindow.focus();
    return;
  }

  recipeWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'IDONI App - Fichas Técnicas',
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  recipeWindow.loadFile('FichaTecnica/recipe-cards.html');

  // Abrir DevTools en desarrollo
  if (process.argv.includes('--dev')) {
    recipeWindow.webContents.openDevTools();
  }

  recipeWindow.on('closed', () => {
    recipeWindow = null;
  });
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// IPC handlers para manejo de archivos
ipcMain.handle('select-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Archivos Excel', extensions: ['xlsx', 'xls'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.handle('save-file', async (event, data) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    filters: [
      { name: 'Archivos Excel', extensions: ['xlsx'] },
      { name: 'Archivos JSON', extensions: ['json'] }
    ]
  });
  
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    return result.filePath;
  }
  return null;
});

ipcMain.handle('export-table', async (event, data, fileName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: fileName || 'Ficha_Tecnica.html',
    filters: [
      { name: 'Archivos HTML', extensions: ['html'] },
      { name: 'Archivos PDF', extensions: ['pdf'] }
    ]
  });
  
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, data);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('export-excel', async (event, data, fileName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: fileName,
    filters: [
      { name: 'Archivos Excel', extensions: ['xlsx'] }
    ]
  });
  
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, data);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('export-pdf', async (event, buffer, fileName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: fileName,
    filters: [
      { name: 'Archivos PDF', extensions: ['pdf'] }
    ]
  });
  
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, buffer);
    return result.filePath;
  }
  return null;
});

// IPC handlers para comunicación entre ventanas
ipcMain.handle('open-excel-window', () => {
  createExcelWindow();
  return true;
});

ipcMain.handle('open-recipe-window', () => {
  createRecipeWindow();
  return true;
});

ipcMain.handle('close-excel-window', () => {
  if (excelWindow) {
    excelWindow.close();
  }
  return true;
});

ipcMain.handle('get-window-count', () => {
  return BrowserWindow.getAllWindows().length;
}); 