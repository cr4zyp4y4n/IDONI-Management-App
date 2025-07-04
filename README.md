# IDONI Kronos 🚀

**Gestor de Excel y Fichas Técnicas para Escritorio**

IDONI Kronos es una aplicación de escritorio desarrollada con Electron que te permite gestionar archivos Excel de manera avanzada y crear fichas técnicas profesionales para cocina.

## ✨ Características Principales

### 📊 Gestor de Excel
- **Carga avanzada**: Soporte para archivos .xlsx y .xls
- **Filtros inteligentes**: Filtrado por categorías, proveedores, familias y más
- **Vista simplificada**: Muestra solo los datos esenciales
- **Búsqueda global**: Busca en todos los campos simultáneamente
- **Paginación optimizada**: Navegación fluida por grandes volúmenes de datos
- **Exportación**: Guarda datos filtrados en múltiples formatos

### 👨‍🍳 Fichas Técnicas
- **Gestión de recetas**: Crea y edita fichas técnicas completas
- **Cálculo automático**: Costes, pesos y gastos calculados automáticamente
- **Alérgenos**: Detección y gestión de alérgenos
- **Exportación**: Genera fichas en HTML y PDF
- **Historial**: Guarda y gestiona todas tus recetas

## 🎨 Iconos y Branding

La aplicación incluye un conjunto completo de iconos en múltiples formatos:

### Archivos de Icono Disponibles
- `idoni-icon.ico` - Icono principal para Windows
- `idoni-icon-16.png` - Favicon 16x16
- `idoni-icon-32.png` - Favicon 32x32
- `idoni-icon-180.png` - Icono Apple Touch (180x180)
- `idoni-icon-192.png` - Icono Android (192x192)
- `idoni-icon-512.png` - Icono de alta resolución (512x512)
- `idoni-icon.svg` - Versión vectorial escalable

### Uso de Iconos
- **Ventana de aplicación**: Usa `idoni-icon.ico` en Windows
- **Favicons web**: Incluye todos los tamaños para compatibilidad
- **Build de distribución**: Configurado para usar iconos específicos por plataforma

## 🚀 Instalación y Uso

### Requisitos Previos
- Node.js (versión 16 o superior)
- npm o yarn

### Instalación
```bash
# Clonar el repositorio
git clone [URL_DEL_REPOSITORIO]
cd IDONI-Project

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar en modo producción
npm start
```

### Construir para Distribución
```bash
# Construir para Windows
npm run build

# Construir sin publicar
npm run dist
```

## 📁 Estructura del Proyecto

```
IDONI Project/
├── assets/                 # Iconos y recursos
│   ├── idoni-icon.ico     # Icono principal
│   ├── idoni-icon-*.png   # Iconos en diferentes tamaños
│   └── idoni-icon.svg     # Versión vectorial
├── MainMenu/              # Menú principal
├── GestionExcel/          # Gestor de Excel
├── FichaTecnica/          # Fichas técnicas
├── styles/                # Estilos CSS
├── fonts/                 # Fuentes personalizadas
├── main.js               # Proceso principal de Electron
├── package.json          # Configuración del proyecto
└── README.md             # Este archivo
```

## 🎯 Funcionalidades Destacadas

### Gestor de Excel
- **Drag & Drop**: Arrastra archivos Excel directamente
- **Filtros avanzados**: Por categoría, proveedor, estado, etc.
- **Vista dual**: Completa y simplificada
- **Búsqueda inteligente**: En tiempo real
- **Paginación**: Navegación optimizada
- **Exportación**: Múltiples formatos

### Fichas Técnicas
- **Formulario intuitivo**: Interfaz fácil de usar
- **Cálculos automáticos**: Costes y márgenes
- **Gestión de alérgenos**: Detección automática
- **Exportación**: HTML y PDF
- **Historial**: Búsqueda y gestión

## 🎨 Diseño y UX

- **Interfaz moderna**: Diseño limpio y profesional
- **Animaciones suaves**: Transiciones fluidas
- **Responsive**: Adaptable a diferentes tamaños
- **Accesibilidad**: Navegación por teclado
- **Temas**: Colores consistentes con la marca IDONI

## 🔧 Configuración Técnica

### Tecnologías Utilizadas
- **Electron**: Framework de aplicaciones de escritorio
- **HTML5/CSS3**: Interfaz de usuario
- **JavaScript ES6+**: Lógica de aplicación
- **XLSX**: Procesamiento de archivos Excel
- **Feather Icons**: Iconografía moderna

### Configuración de Build
- **Windows**: NSIS installer con icono personalizado
- **macOS**: DMG con icono de alta resolución
- **Linux**: AppImage con icono vectorial

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo LICENSE para más detalles.

## 📞 Soporte

Para soporte técnico o preguntas sobre la aplicación, contacta con el equipo de desarrollo de IDONI.

---

**© 2024 IDONI Project. Todos los derechos reservados.** 