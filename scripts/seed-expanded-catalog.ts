
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan credenciales de Supabase (URL o Service Key).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedExpandedCatalog() {
  console.log('🚀 Iniciando expansión del catálogo...');

  try {
    // 1. Insertar Marcas
    console.log('\n📦 Insertando marcas...');
    const brands = [
      'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Asus', 'Microsoft', 'Nintendo', 'Canon', 'Epson',
      'Xiaomi', 'Huawei', 'Motorola', 'Logitech', 'Kingston', 'JBL', 'Acer', 'Razer', 'Corsair',
      'MSI', 'Gigabyte', 'AMD', 'Intel', 'Nvidia', 'Western Digital', 'Seagate', 'TP-Link',
      'Ubiquiti', 'Hikvision', 'Dahua'
    ];

    const { error: brandsError } = await supabase
      .from('brands')
      .upsert(
        brands.map(name => ({ name, is_active: true })),
        { onConflict: 'name', ignoreDuplicates: true }
      );

    if (brandsError) {
      console.error('❌ Error insertando marcas:', brandsError.message);
    } else {
      console.log('✅ Marcas procesadas.');
    }

    // 2. Insertar Categorías Principales
    console.log('\n📂 Insertando categorías principales...');
    const topCategories = [
      { name: 'Informática', description: 'Computadoras, portátiles y componentes' },
      { name: 'Audio y Video', description: 'Equipos de sonido, TV y video' },
      { name: 'Gaming', description: 'Consolas, juegos y accesorios gamer' },
      { name: 'Oficina', description: 'Equipamiento y suministros de oficina' },
      { name: 'Redes', description: 'Routers, switches y conectividad' },
      { name: 'Seguridad', description: 'Cámaras de vigilancia y alarmas' }
    ];

    // Verificar cuáles ya existen
    const { data: existingCats, error: fetchError } = await supabase
      .from('categories')
      .select('name')
      .in('name', topCategories.map(c => c.name));

    if (fetchError) {
      console.error('❌ Error verificando categorías:', fetchError.message);
    }

    const existingNames = new Set(existingCats?.map(c => c.name) || []);
    const catsToInsert = topCategories.filter(c => !existingNames.has(c.name));

    if (catsToInsert.length > 0) {
      const { error } = await supabase
        .from('categories')
        .insert(catsToInsert.map(c => ({ ...c, is_active: true })));
      
      if (error) console.error('❌ Error insertando categorías:', error.message);
      else console.log(`✅ ${catsToInsert.length} nuevas categorías insertadas.`);
    } else {
      console.log('ℹ️ Todas las categorías principales ya existen.');
    }

    // 3. Obtener IDs de Categorías Principales (para subcategorías)
    const { data: categories, error: catFetchError } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', topCategories.map(c => c.name));

    if (catFetchError || !categories) {
      console.error('❌ Error obteniendo categorías:', catFetchError?.message);
      return;
    }

    const catMap = new Map(categories.map(c => [c.name, c.id]));

    // 4. Insertar Subcategorías
    console.log('\n📂 Insertando subcategorías...');
    const subCategories = [
      // Informática
      { name: 'Notebooks', description: 'Laptops y portátiles', parent: 'Informática' },
      { name: 'Componentes de PC', description: 'Procesadores, RAM, Discos, etc.', parent: 'Informática' },
      { name: 'Periféricos', description: 'Teclados, mouse, monitores', parent: 'Informática' },
      { name: 'Almacenamiento', description: 'Discos duros, SSD, USB', parent: 'Informática' },
      // Audio y Video
      { name: 'Televisores', description: 'Smart TV y pantallas', parent: 'Audio y Video' },
      { name: 'Audífonos', description: 'Auriculares in-ear, over-ear', parent: 'Audio y Video' },
      { name: 'Parlantes', description: 'Bocinas y sistemas de sonido', parent: 'Audio y Video' },
      // Gaming
      { name: 'Consolas', description: 'PlayStation, Xbox, Nintendo', parent: 'Gaming' },
      { name: 'Videojuegos', description: 'Juegos para todas las plataformas', parent: 'Gaming' },
      { name: 'Sillas Gamer', description: 'Sillas ergonómicas para gaming', parent: 'Gaming' },
      // Oficina
      { name: 'Impresoras', description: 'Inyección de tinta, láser, multifuncionales', parent: 'Oficina' },
      { name: 'Suministros', description: 'Tintas, toners, papel', parent: 'Oficina' },
      // Redes
      { name: 'Routers', description: 'Routers WiFi y cableados', parent: 'Redes' },
      { name: 'Switches', description: 'Switches de red', parent: 'Redes' },
      // Seguridad
      { name: 'Cámaras de Seguridad', description: 'Cámaras IP, CCTV', parent: 'Seguridad' },
      { name: 'DVR/NVR', description: 'Grabadores de video', parent: 'Seguridad' }
    ];

    // Verificar subcategorías existentes
    const { data: existingSubCats } = await supabase
      .from('categories')
      .select('name')
      .in('name', subCategories.map(s => s.name));

    const existingSubNames = new Set(existingSubCats?.map(s => s.name) || []);
    
    let subCatsInserted = 0;
    for (const sub of subCategories) {
      if (existingSubNames.has(sub.name)) continue;

      const parentId = catMap.get(sub.parent);
      if (!parentId) {
        console.warn(`⚠️ No se encontró categoría padre para ${sub.name} (${sub.parent})`);
        continue;
      }

      const { error } = await supabase
        .from('categories')
        .insert({ 
          name: sub.name, 
          description: sub.description, 
          parent_id: parentId, 
          is_active: true 
        });

      if (error) console.error(`❌ Error insertando subcategoría ${sub.name}:`, error.message);
      else subCatsInserted++;
    }
    console.log(`✅ ${subCatsInserted} subcategorías insertadas.`);


    // 5. Actualizar productos con Marcas
    console.log('\n🔄 Actualizando productos con marcas...');
    
    // Obtener todas las marcas
    const { data: allBrands, error: brandFetchError } = await supabase
      .from('brands')
      .select('id, name');

    if (brandFetchError || !allBrands) {
      console.error('❌ Error obteniendo marcas:', brandFetchError?.message);
      return;
    }

    const brandMap = new Map(allBrands.map(b => [b.name.toLowerCase(), b.id]));

    // Obtener productos que tienen marca en texto pero no brand_id
    const { data: productsToUpdate, error: prodError } = await supabase
      .from('products')
      .select('id, brand')
      .not('brand', 'is', null)
      .is('brand_id', null);

    if (prodError) {
      console.error('❌ Error obteniendo productos:', prodError.message);
    } else if (productsToUpdate && productsToUpdate.length > 0) {
      console.log(`Encontrados ${productsToUpdate.length} productos para actualizar.`);
      
      let updatedCount = 0;
      for (const prod of productsToUpdate) {
        const brandName = prod.brand?.trim();
        if (!brandName) continue;

        // Intentar encontrar la marca (case insensitive)
        let brandId = brandMap.get(brandName.toLowerCase());
        
        // Si no existe, intentar buscar coincidencia parcial o crearla? 
        // Por ahora solo coincidencia exacta
        
        if (brandId) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ brand_id: brandId })
            .eq('id', prod.id);
            
          if (updateError) {
            console.error(`❌ Error actualizando producto ${prod.id}:`, updateError.message);
          } else {
            updatedCount++;
          }
        }
      }
      console.log(`✅ ${updatedCount} productos actualizados con su brand_id.`);
    } else {
      console.log('No hay productos pendientes de actualización de marca.');
    }

    console.log('\n🎉 ¡Expansión del catálogo completada exitosamente!');

  } catch (err) {
    console.error('❌ Error general:', err);
  }
}

seedExpandedCatalog();
