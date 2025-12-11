// CÓDIGO GOOGLE APPS SCRIPT (VERSIÓN 2 - ANTI-ERRORES)
// -------------------------------------------------------------
// 1. Ve a Extensiones > Apps Script.
// 2. BORRA TODO y pega este código nuevo.
// 3. Dale a Guardar.
// 4. IMPORTANTE: Dale a "Implantar" > "Nueva implementación" (OBLIGATORIO crear nueva para que se actualice).
// 5. Copia la nueva URL si cambia, o asegúrate de que es la misma.
// -------------------------------------------------------------

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheetIfNeeded(ss, 'Config', ['Key', 'Value']);
  createSheetIfNeeded(ss, 'Opciones', ['ID', 'Nombre', 'Activo']);
  createSheetIfNeeded(ss, 'Votos', ['Fecha', 'Usuario', 'Opciones']);

  // Defaults
  if (getVal(ss, 'Config', 'voting_open') === null) setVal(ss, 'Config', 'voting_open', 'true');

  const optSheet = ss.getSheetByName('Opciones');
  if (optSheet.getLastRow() === 1) {
    optSheet.appendRow([1, 'Opción A (Ejemplo)', true]);
    optSheet.appendRow([2, 'Opción B (Ejemplo)', true]);
  }
}

function createSheetIfNeeded(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function getVal(ss, sheetName, key) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == key) return data[i][1];
  }
  return null;
}

function setVal(ss, sheetName, key, value) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = createSheetIfNeeded(ss, sheetName, ['Key', 'Value']);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// --- API ---

function doGet(e) {
  // WRAPPER DE SEGURIDAD: Cualquier error devolverá JSON, no HTML
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Auto-reparación: Si no existen las hojas, crearlas al vuelo
    if (!ss.getSheetByName('Config')) setup();

    // 1. Leer Config
    const open = getVal(ss, 'Config', 'voting_open');

    // 2. Leer Opciones
    const optSheet = ss.getSheetByName('Opciones');
    const optData = optSheet ? optSheet.getDataRange().getValues() : [];
    let options = [];
    for (let i = 1; i < optData.length; i++) {
      if (optData[i][2] === true || optData[i][2] === 'true') {
        options.push({ id: optData[i][0], name: optData[i][1] });
      }
    }

    // 3. Contar Votos
    const voteSheet = ss.getSheetByName('Votos');
    const voteData = voteSheet ? voteSheet.getDataRange().getValues() : [];
    let counts = {};
    options.forEach(o => counts[o.name] = 0);

    for (let i = 1; i < voteData.length; i++) {
      const choices = String(voteData[i][2]).split(',');
      choices.forEach(c => {
        let t = c.trim();
        if (counts[t] !== undefined) counts[t]++;
      });
    }

    return responseJSON({
      status: 'success',
      voting_open: (open === 'true' || open === true),
      options: options,
      results: counts,
      total_votes: Math.max(0, voteData.length - 1)
    });

  } catch (err) {
    // ESTO EVITA EL ERROR CORS: Devuelve JSON incluso si falla
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    // Si no viene postData, es un error
    if (!e || !e.postData) return responseJSON({ status: 'error', message: 'No post data' });

    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName('Config')) setup();

    if (action === 'vote') {
      const sheet = ss.getSheetByName('Votos');
      // Asegurar que es string
      const choices = Array.isArray(data.options) ? data.options.join(',') : (data.options || '');
      sheet.appendRow([new Date(), data.user || 'Anon', choices]);
      return responseJSON({ status: 'success' });
    }

    // ADMIN ACTIONS
    if (action === 'reset') {
      const sheet = ss.getSheetByName('Votos');
      if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
      return responseJSON({ status: 'success' });
    }

    if (action === 'close') {
      setVal(ss, 'Config', 'voting_open', 'false');
      return responseJSON({ status: 'success' });
    }

    if (action === 'open') {
      setVal(ss, 'Config', 'voting_open', 'true');
      return responseJSON({ status: 'success' });
    }

    if (action === 'add_option') {
      const sheet = ss.getSheetByName('Opciones');
      const id = new Date().getTime();
      sheet.appendRow([id, data.name, true]);
      return responseJSON({ status: 'success' });
    }

    return responseJSON({ status: 'error', message: 'Action unknown' });

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
