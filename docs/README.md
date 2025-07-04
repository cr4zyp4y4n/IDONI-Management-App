# IDONI App - Documentación

## Descripción
IDONI App es una aplicación de escritorio desarrollada con Electron para la gestión de datos Excel y creación de fichas técnicas de cocina. Diseñada específicamente para IDONI, especialistas en gastronomía mediterránea.

## Características Principales

### 📊 Gestor de Excel
- Carga y análisis de archivos Excel
- Filtros avanzados y búsqueda global
- Vista simplificada de datos
- Exportación de resultados

### 👨‍🍳 Fichas Técnicas
- Creación de recetas profesionales
- Gestión de ingredientes y costes
- Control de alérgenos automático
- Exportación a HTML y PDF

## Estructura del Proyecto

```
IDONI Project/
├── MainMenu/              # Menú principal de la aplicación
│   ├── main-menu.html
│   └── main-menu.js
├── GestionExcel/          # Módulo de gestión Excel
│   ├── excel-manager.html
│   └── excel-manager.js
├── FichaTecnica/          # Módulo de fichas técnicas
│   ├── recipe-cards.html
│   └── recipe-cards.js
├── assets/                # Recursos multimedia
│   ├── Logo IDONI pequeño.webp
│   └── icon.png
├── fonts/                 # Tipografías personalizadas
│   ├── address-sans-pro-bold.otf
│   └── fredoka-bold.ttf
├── utils/                 # Utilidades compartidas
│   └── file-utils.js
├── config/                # Configuración
│   └── app.config.js
├── styles/                # Estilos CSS (futuro)
├── docs/                  # Documentación
├── main.js               # Proceso principal de Electron
├── renderer.js           # Renderer principal
└── package.json          # Configuración del proyecto
```

## Instalación y Uso

### Requisitos
- Node.js 16 o superior
- npm o yarn

### Instalación
```bash
npm install
```

### Desarrollo
```bash
npm run dev
```

### Construcción
```bash
npm run build
```

## Atajos de Teclado

- `Ctrl + 1`: Abrir Gestor de Excel
- `Ctrl + 2`: Abrir Fichas Técnicas
- `Ctrl + H`: Mostrar ayuda
- `Ctrl + S`: Guardar (en módulos activos)

## Tecnologías Utilizadas

- **Electron**: Framework de aplicaciones de escritorio
- **XLSX**: Manejo de archivos Excel
- **jsPDF**: Generación de PDFs
- **Feather Icons**: Iconografía
- **Inter Font**: Tipografía principal

## Versión
2.0.0 - Sistema de Ventanas Múltiples

## Lema
"Menja sa, viu feliç" - Come sano, vive feliz

## Soporte
Para soporte técnico, contacta con el equipo de desarrollo de IDONI. 