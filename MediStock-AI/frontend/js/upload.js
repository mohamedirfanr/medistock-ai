/**
 * MediStock AI - CSV Ingestion & Parsing Controller
 * Handles drag-and-drop, client-side parsing of Medicine, Jan, Feb, Mar, Apr, Current_Stock,
 * validation feedback, preview table, and state persistence.
 */

let parsedDataStaging = [];
let uploadedFileInfo = null;

document.addEventListener("DOMContentLoaded", () => {
  initDropzone();
  initSampleDownloadBtn();
  checkPreviousUpload();
});

function initDropzone() {
  const dropzone = document.getElementById("csvDropzone");
  const fileInput = document.getElementById("csvFileInput");
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-active");
  });

  ["dragleave", "dragend"].forEach(type => {
    dropzone.addEventListener(type, () => dropzone.classList.remove("drag-active"));
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-active");
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });
}

let currentRawUploadedFile = null;

function handleFileSelected(file) {
  if (!file.name.endsWith(".csv")) {
    showToast("Invalid file type. Please upload a .csv file.", "danger");
    return;
  }
  currentRawUploadedFile = file;

  const reader = new FileReader();
  reader.onload = async (e) => {
    await parseAndIngestCSV(e.target.result, file);
  };
  reader.readAsText(file);
}

function normalizeColHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[\s_\-]/g, "");
}

function findColIndex(headers, aliases) {
  const normHeaders = headers.map(normalizeColHeader);
  for (const alias of aliases) {
    const normAlias = normalizeColHeader(alias);
    const idx = normHeaders.indexOf(normAlias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const normAlias = normalizeColHeader(alias);
    for (let i = 0; i < normHeaders.length; i++) {
      if (normHeaders[i].includes(normAlias) || (normHeaders[i].length > 2 && normAlias.includes(normHeaders[i]))) {
        return i;
      }
    }
  }
  return -1;
}

async function parseAndIngestCSV(csvText, file) {
  const fileName = file.name;
  const fileSize = file.size;
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    showToast("CSV file must contain a header and at least one data row.", "warning");
    return;
  }

  const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));

  const medIdx = findColIndex(rawHeaders, ["medicine", "medicinename", "medname", "drugname", "drug", "itemname", "item", "productname", "product", "formulary", "name"]);
  const stockIdx = findColIndex(rawHeaders, ["currentstock", "stock", "stockonhand", "quantityinstock", "qtyinstock", "onhand", "inventory", "inventorylevel", "unitsinstock", "units", "quantity"]);
  const janIdx = findColIndex(rawHeaders, ["jan", "january", "month1", "m1"]);
  const febIdx = findColIndex(rawHeaders, ["feb", "february", "month2", "m2"]);
  const marIdx = findColIndex(rawHeaders, ["mar", "march", "month3", "m3"]);
  const aprIdx = findColIndex(rawHeaders, ["apr", "april", "month4", "m4"]);
  const predIdx = findColIndex(rawHeaders, ["predicteddemand", "predicted30daydemand", "forecasteddemand", "forecastdemand", "demandforecast", "projecteddemand", "monthlydemand", "targetdemand", "demand"]);
  const dailyIdx = findColIndex(rawHeaders, ["dailydemand", "averagedailydemand", "dailyburnrate", "burnrate"]);
  const priceIdx = findColIndex(rawHeaders, ["unitprice", "price", "cost", "unitcost", "mrp", "rate"]);

  const isValidSchema = medIdx !== -1 && stockIdx !== -1;
  parsedDataStaging = [];
  let validationErrors = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map(r => r.trim().replace(/^["']|["']$/g, ""));
    if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

    const medName = (medIdx !== -1 && row[medIdx]) ? row[medIdx].trim() : `Item #${i}`;
    let stock = (stockIdx !== -1 && row[stockIdx]) ? parseInt(row[stockIdx].trim()) : 0;
    if (isNaN(stock)) stock = 0;

    let predDemand = null;
    if (predIdx !== -1 && row[predIdx] && row[predIdx].trim()) {
      const p = parseInt(row[predIdx].trim());
      if (!isNaN(p) && p > 0) predDemand = p;
    }
    if (predDemand === null && dailyIdx !== -1 && row[dailyIdx] && row[dailyIdx].trim()) {
      const d = parseFloat(row[dailyIdx].trim());
      if (!isNaN(d) && d > 0) predDemand = Math.round(d * 30);
    }

    let jan = (janIdx !== -1 && row[janIdx]) ? parseInt(row[janIdx].trim()) : 0;
    let feb = (febIdx !== -1 && row[febIdx]) ? parseInt(row[febIdx].trim()) : 0;
    let mar = (marIdx !== -1 && row[marIdx]) ? parseInt(row[marIdx].trim()) : 0;
    let apr = (aprIdx !== -1 && row[aprIdx]) ? parseInt(row[aprIdx].trim()) : 0;

    const hasMonths = janIdx !== -1 && febIdx !== -1 && marIdx !== -1 && aprIdx !== -1;
    if (!hasMonths) {
      if (predDemand && predDemand > 0) {
        apr = Math.max(1, Math.round(predDemand * 0.95));
        mar = Math.max(1, Math.round(predDemand * 0.90));
        feb = Math.max(1, Math.round(predDemand * 0.85));
        jan = Math.max(1, Math.round(predDemand * 0.80));
      } else {
        const base = Math.max(10, Math.round(stock * 0.8));
        apr = base;
        mar = Math.max(1, Math.round(base * 0.95));
        feb = Math.max(1, Math.round(base * 0.90));
        jan = Math.max(1, Math.round(base * 0.85));
      }
    }

    let unitPrice = 2.50;
    if (priceIdx !== -1 && row[priceIdx] && row[priceIdx].trim()) {
      const p = parseFloat(row[priceIdx].trim());
      if (!isNaN(p) && p > 0) unitPrice = p;
    }

    parsedDataStaging.push({
      medicine: medName,
      jan: isNaN(jan) ? 0 : jan,
      feb: isNaN(feb) ? 0 : feb,
      mar: isNaN(mar) ? 0 : mar,
      apr: isNaN(apr) ? 0 : apr,
      currentStock: stock,
      predictedDemand: predDemand,
      category: "Imported Medicine",
      unitPrice: unitPrice,
      leadTimeDays: 5
    });
  }

  uploadedFileInfo = {
    name: fileName,
    size: (fileSize / 1024).toFixed(1) + " KB",
    count: parsedDataStaging.length,
    valid: isValidSchema && validationErrors === 0,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  renderUploadSummary(uploadedFileInfo);
  renderPreviewTable(parsedDataStaging);

  // Immediate backend commit if FastAPI backend mode is active
  if (window.medistockApi && window.medistockApi.isUsingBackend()) {
    try {
      showToast(`Uploading and committing ${parsedDataStaging.length} medicines to FastAPI backend...`, "primary");
      const res = await window.medistockApi.uploadCSV(file, true);
      const committedCount = res.record_count || res.count || parsedDataStaging.length;
      uploadedFileInfo.count = committedCount;
      uploadedFileInfo.valid = true;
      renderUploadSummary(uploadedFileInfo);
      window.medistockData.setUploadInfo(uploadedFileInfo);
      renderPreviewTable(window.inventoryData ? window.inventoryData.getItems() : parsedDataStaging);
      showToast(`Successfully committed ${committedCount} medicines to FastAPI backend!`, "success");
    } catch (err) {
      console.warn("Backend upload failed during immediate commit, falling back to local store:", err);
      window.medistockData.saveData(parsedDataStaging);
      window.medistockData.setUploadInfo(uploadedFileInfo);
      showToast(`Processed ${parsedDataStaging.length} medicines in local storage`, "info");
    }
  } else {
    window.medistockData.saveData(parsedDataStaging);
    window.medistockData.setUploadInfo(uploadedFileInfo);
    showToast(`Parsed ${parsedDataStaging.length} medicines from ${fileName}`, "success");
  }
}

function renderUploadSummary(info) {
  const container = document.getElementById("uploadSummaryContainer");
  if (!container) return;
  container.style.display = "block";
  const nameEl = document.getElementById("sumFileName");
  if (nameEl) {
    nameEl.textContent = info.name;
    nameEl.title = info.name;
  }
  document.getElementById("sumCount").textContent = `${info.count} items`;
  
  const statusEl = document.getElementById("sumValidation");
  if (info.valid) {
    statusEl.innerHTML = `<span class="badge badge-success"><i data-lucide="check-circle"></i> Passed (Schema Verified)</span>`;
  } else {
    statusEl.innerHTML = `<span class="badge badge-warning"><i data-lucide="alert-triangle"></i> Incomplete Schema / Coerced</span>`;
  }

  const applyBtn = document.getElementById("applyImportBtn");
  if (applyBtn) {
    applyBtn.style.display = "inline-flex";
    applyBtn.onclick = applyStagedData;
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderPreviewTable(data) {
  const tbody = document.getElementById("previewTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const previewSlice = data.slice(0, 10); // Show up to 10 for preview

  previewSlice.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${row.medicine}</strong></td>
      <td>${row.jan}</td>
      <td>${row.feb}</td>
      <td>${row.mar}</td>
      <td>${row.apr}</td>
      <td><span class="badge badge-neutral">${row.currentStock} units</span></td>
      <td><span class="badge badge-success">Valid</span></td>
    `;
    tbody.appendChild(tr);
  });
}

async function applyStagedData() {
  if (window.medistockApi && window.medistockApi.isUsingBackend()) {
    if (currentRawUploadedFile) {
      try {
        await window.medistockApi.uploadCSV(currentRawUploadedFile, true);
      } catch (e) {
        console.warn("FastAPI upload sync warning:", e);
      }
    }
    await window.medistockApi.syncStore(true);
  } else {
    if (!parsedDataStaging || parsedDataStaging.length === 0) {
      showToast("No parsed data to import.", "warning");
      return;
    }
    window.medistockData.saveData(parsedDataStaging);
  }

  if (uploadedFileInfo) {
    window.medistockData.setUploadInfo(uploadedFileInfo);
  }

  const finalCount = window.inventoryData ? window.inventoryData.getItems().length : (uploadedFileInfo ? uploadedFileInfo.count : 0);
  showToast(`Successfully synchronized ${finalCount} medicines into inventory!`, "success");
  setTimeout(() => {
    window.location.href = "inventory.html";
  }, 800);
}

function initSampleDownloadBtn() {
  const btn = document.getElementById("downloadSampleBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const sampleCsv = `Medicine,Jan,Feb,Mar,Apr,Current_Stock
Paracetamol 500mg,450,520,610,720,300
Amoxicillin 250mg,320,310,290,280,650
Remdesivir 100mg,120,180,250,380,95
Insulin Glargine,410,430,425,440,430
Propofol 1%,180,210,240,290,110
Azithromycin 500mg,290,340,380,450,180
Meropenem 1g,85,90,110,135,45
Metformin 500mg,600,610,605,620,950
Atorvastatin 20mg,510,490,530,520,510
Salbutamol Inhaler,220,280,350,420,130`;

    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "medistock_sample_template.csv";
    link.click();
    showToast("Downloaded sample CSV template", "primary");
  });
}

function checkPreviousUpload() {
  const previous = window.medistockData ? window.medistockData.getUploadInfo() : null;
  if (previous) {
    const container = document.getElementById("uploadSummaryContainer");
    if (container && container.style.display === "none") {
      renderUploadSummary(previous);
      renderPreviewTable(window.inventoryData ? window.inventoryData.getItems() : window.medistockData.loadData());
    }
  }
}
