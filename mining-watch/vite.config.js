import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REPO_BASE = '/projet8_hackathon/'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? REPO_BASE : '/',
  server: {
    proxy: {
      '/api/camino': {
        target: 'https://api.camino.beta.gouv.fr',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/camino/, ''),
      },
      '/api/midas': {
        target: 'https://cbdgmapa.pgi.gov.pl/arcgis/rest/services/midas',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/midas/, ''),
      },
      '/api/gtk': {
        target: 'https://gtkdata.gtk.fi/arcgis/rest/services/Rajapinnat/GTK_Kalliopera_WFS',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/gtk/, ''),
      },
      '/api/nlog': {
        target: 'https://www.nlog.nl/standalone/rest/services/nlog_gdn',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/nlog/, ''),
      },
      '/api/dmf': {
        target: 'https://www.dirmin.no',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/dmf/, ''),
      },
      '/api/igme': {
        target: 'https://mapas.igme.es',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/igme/, ''),
      },
      '/api/geosphere': {
        target: 'https://gis.geosphere.at',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/geosphere/, ''),
      },
      '/api/cgs': {
        target: 'https://mapy.geology.cz',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/cgs/, ''),
      },
      '/api/geoswiss': {
        target: 'https://api3.geo.admin.ch',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/geoswiss/, ''),
      },
      '/api/copernicus': {
        target: 'https://sh.dataspace.copernicus.eu',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/copernicus/, ''),
      },
      '/api/sgu': {
        target: 'https://maps3.sgu.se',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/sgu/, ''),
      },
    },
  },
})
