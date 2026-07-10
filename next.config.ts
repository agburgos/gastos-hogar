import type { NextConfig } from "next";
import path from "path";
import fs from "fs";
import os from "os";

// node_modules y .next viven fuera de OneDrive (en una carpeta hermana bajo
// ~/Library/CloudStorage) en máquinas donde el proyecto está dentro de una
// carpeta sincronizada, para evitar que la sincronización en la nube
// corrompa el dev server. Ampliamos turbopack.root solo a ese ancestro común
// (no a todo el $HOME, que es enorme y dispara una condición de carrera
// conocida de Turbopack en builds). Si esa ruta no existe (ej. en Vercel),
// no se sobreescribe el root y Next usa su detección automática.
const cloudStorageDir = path.join(os.homedir(), "Library", "CloudStorage");
const turbopackRoot = fs.existsSync(cloudStorageDir) ? cloudStorageDir : undefined;

const nextConfig: NextConfig = {
  ...(turbopackRoot ? { turbopack: { root: turbopackRoot } } : {}),
};

export default nextConfig;
