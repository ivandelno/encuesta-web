// CÓDIGO GOOGLE APPS SCRIPT
// -------------------------------------------------------------
// 1. Ve a tu Hoja de Cálculo de Google.
// 2. Click en: Extensiones > Apps Script.
// 3. Borra todo lo que salga y pega este código.
// 4. Dale a "Guardar" y luego a "Implantar" (Deploy) > "Nueva implementación".
// 5. Configura:
//      - Tipo: Aplicación web
//      - Ejecutar como: "Yo"
//      - Quién tiene acceso: "Cualquier persona" (IMPORTANTE)
// 6. Copia la URL que te da (termina en /exec) y pégala en tu web.
// -------------------------------------------------------------

// CONFIGURACIÓN INICIAL
// Al ejecutar la función 'setup()', se crearán las hojas necesarias
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheetIfNeeded(ss, 'Config', ['Key', 'Value']);
  createSheetIfNeeded(ss, 'Opciones', ['ID', 'Nombre', 'Activo']);
  createSheetIfNeeded(ss, 'Votos', ['Fecha', 'Usuario', 'Opciones']);
  
  // Configuración por defecto
  setVal('Config', 'voting_open', 'true');
  
  // Opciones por defecto si está vacío
  const optSheet = ss.getSheetByName('Opciones');
  if (optSheet.getLastRow() === 1) {
    optSheet.appendRow([1, 'Opción Ejemplo 1', true]);
    optSheet.appendRow([2, 'Opción Ejemplo 2', true]);
    optSheet.appendRow([3, 'Opción Ejemplo 3', true]);
  }
}

function createSheetIfNeeded(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
}

function setVal(sheetName, key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// API: MANEJO DE GET (Leer datos)
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Leer estado de la votación
  const configSheet = ss.getSheetByName('Config');
  const configData = configSheet.getDataRange().getValues();
  let open = 'true';
  configData.forEach(row => { if(row[0] === 'voting_open') open = row[1] });
  
  // 2. Leer Opciones
  const optSheet = ss.getSheetByName('Opciones');
  const optData = optSheet.getDataRange().getValues();
  let options = [];
  // Empezamos en 1 para saltar cabecera
  for (let i = 1; i < optData.length; i++) {
    if (optData[i][2] === true || optData[i][2] === 'true') {
      options.push({ id: optData[i][0], name: optData[i][1] });
    }
  }

  // 3. Leer Resultados (Contar votos)
  const voteSheet = ss.getSheetByName('Votos');
  const voteData = voteSheet.getDataRange().getValues();
  let counts = {};
  
  // Inicializar conteo
  options.forEach(o => counts[o.name] = 0);
  
  // Contar (saltando cabecera)
  for (let i = 1; i < voteData.length; i++) {
    const choices = String(voteData[i][2]).split(','); // "Opción A,Opción B,..."
    choices.forEach(choice => {
      let trimmed = choice.trim();
      if (counts[trimmed] !== undefined) {
        counts[trimmed]++;
      }
    });
  }

  return responseJSON({
    status: 'success',
    voting_open: open === 'true' || open === true,
    options: options,
    results: counts,
    total_votes: voteData.length - 1
  });
}

// API: MANEJO DE POST (Acciones: Votar, Admin)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'vote') {
        const sheet = ss.getSheetByName('Votos');
        // data.options debe ser un array o string separado por comas
        const choices = Array.isArray(data.options) ? data.options.join(',') : data.options;
        sheet.appendRow([new Date(), data.user, choices]);
        return responseJSON({ status: 'success', message: 'Voto registrado' });
    }
    
    // --- ACCIONES DE ADMIN ---
    
    if (action === 'reset') {
        const sheet = ss.getSheetByName('Votos');
        // Borrar todo menos la cabecera
        if (sheet.getLastRow() > 1) {
          sheet.deleteRows(2, sheet.getLastRow() - 1);
        }
        return responseJSON({ status: 'success', message: 'Votos reseteados' });
    }

    if (action === 'close') {
        setVal('Config', 'voting_open', 'false');
        return responseJSON({ status: 'success', message: 'Votación cerrada' });
    }
    
    if (action === 'open') {
        setVal('Config', 'voting_open', 'true');
        return responseJSON({ status: 'success', message: 'Votación abierta' });
    }

    if (action === 'add_option') {
        const sheet = ss.getSheetByName('Opciones');
        const id = new Date().getTime(); // ID simple
        sheet.appendRow([id, data.name, true]);
        return responseJSON({ status: 'success', message: 'Opción añadida' });
    }
    
    if (action === 'export_csv') {
       // Devuelve los datos brutos para que el frontend genere el CSV
       const sheet = ss.getSheetByName('Votos');
       const data = sheet.getDataRange().getValues();
       return responseJSON({ status: 'success', data: data });
    }

    return responseJSON({ status: 'error', message: 'Acción desconocida' });

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
