// Web Worker para procesamiento de imágenes sin bloquear la UI principal

self.onmessage = async function(e) {
  const { file, options, id } = e.data;
  
  try {
    // Convertir File a ImageBitmap para mejor rendimiento
    const imageBitmap = await createImageBitmap(file);
    
    const {
      maxWidth = 512,
      maxHeight = 512,
      quality = 0.9,
      format = 'image/webp',
      cropSquare = true,
      rotate = 0
    } = options;

    // Calcular dimensiones
    let { width, height } = imageBitmap;
    let sx = 0, sy = 0, sWidth = width, sHeight = height;

    // Aplicar recorte cuadrado si está habilitado
    if (cropSquare) {
      const side = Math.min(width, height);
      sx = Math.floor((width - side) / 2);
      sy = Math.floor((height - side) / 2);
      sWidth = side;
      sHeight = side;
      width = side;
      height = side;
    }

    // Calcular tamaño final respetando límites
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const finalWidth = Math.round(width * scale);
    const finalHeight = Math.round(height * scale);

    // Ajustar para rotación
    const rotated = (Math.round(rotate) % 360 + 360) % 360;
    const willRotate = rotated === 90 || rotated === 270;
    const canvasWidth = willRotate ? finalHeight : finalWidth;
    const canvasHeight = willRotate ? finalWidth : finalHeight;

    // Crear canvas offscreen para mejor rendimiento
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // Configurar calidad de renderizado
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Aplicar rotación si es necesaria
    if (rotated) {
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.rotate((rotated * Math.PI) / 180);
      ctx.translate(-canvasHeight / 2, -canvasWidth / 2);
    }

    // Dibujar imagen procesada
    ctx.drawImage(
      imageBitmap, 
      sx, sy, sWidth, sHeight,
      0, 0, willRotate ? finalHeight : finalWidth, willRotate ? finalWidth : finalHeight
    );

    // Convertir a blob con la calidad especificada
    const blob = await canvas.convertToBlob({
      type: format,
      quality: quality
    });

    // Limpiar recursos
    imageBitmap.close();

    // Enviar resultado
    self.postMessage({
      id,
      success: true,
      blob,
      originalSize: file.size,
      processedSize: blob.size,
      compressionRatio: ((file.size - blob.size) / file.size * 100).toFixed(1)
    });

  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};