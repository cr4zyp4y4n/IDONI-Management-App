const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Utilidades para manejo de archivos
class FileUtils {
  
  // Leer archivo Excel
  static async readExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      return {
        success: true,
        data: data,
        headers: data[0] || [],
        rows: data.slice(1) || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Guardar datos en localStorage
  static saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);
      return false;
    }
  }

  // Leer datos de localStorage
  static getFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error al leer de localStorage:', error);
      return null;
    }
  }

  // Exportar a HTML
  static exportToHTML(data, template) {
    try {
      // Aquí iría la lógica para generar HTML
      return {
        success: true,
        html: template(data)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validar formato de archivo
  static validateFileFormat(fileName, allowedFormats) {
    const extension = path.extname(fileName).toLowerCase().substring(1);
    return allowedFormats.includes(extension);
  }

  // Generar nombre de archivo único
  static generateUniqueFileName(baseName, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${baseName}_${timestamp}.${extension}`;
  }
}

module.exports = FileUtils; 