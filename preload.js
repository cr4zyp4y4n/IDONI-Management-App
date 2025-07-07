const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  exportTable: (data, fileName) => ipcRenderer.invoke('export-table', data, fileName),
  exportExcel: (data, fileName) => ipcRenderer.invoke('export-excel', data, fileName),
  readExcelFile: (filePath) => ipcRenderer.invoke('read-excel-file', filePath),
  openExcelWindow: () => ipcRenderer.invoke('open-excel-window'),
  openRecipeWindow: () => ipcRenderer.invoke('open-recipe-window'),
  closeRecipeWindow: () => ipcRenderer.invoke('close-recipe-window')
}); 