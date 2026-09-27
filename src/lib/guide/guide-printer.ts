import type { GuideSection } from './types'

export interface PrintGuideOptions {
  title?: string
  companyName?: string
  includeExamples?: boolean
  includeFaq?: boolean
  includeTips?: boolean
}

export function printAdminGuide(sections: GuideSection[], options: PrintGuideOptions = {}) {
  if (typeof window === 'undefined') return

  const {
    title = 'Guía y Manual Operativo del Sistema',
    companyName = '4G Gestión',
    includeExamples = true,
    includeFaq = true,
    includeTips = true,
  } = options

  const todayStr = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${companyName}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.45;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 10px;
    }
    .header-banner {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .main-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .subtitle {
      font-size: 9.5pt;
      color: #64748b;
      margin: 0;
    }
    .meta-box {
      text-align: right;
      font-size: 8.5pt;
      color: #475569;
    }
    .section-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      color: #0369a1;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-summary {
      font-size: 9pt;
      color: #475569;
      margin: 0 0 10px 0;
      font-style: italic;
    }
    .steps-list {
      margin: 8px 0;
      padding-left: 20px;
    }
    .steps-list li {
      margin-bottom: 6px;
    }
    .step-title {
      font-weight: 600;
      color: #0f172a;
    }
    .step-desc {
      color: #334155;
      font-size: 8.5pt;
      margin-top: 1px;
    }
    .example-box {
      background: #f8fafc;
      border-left: 3px solid #0284c7;
      border-radius: 4px;
      padding: 8px 12px;
      margin-top: 10px;
      font-size: 8.5pt;
    }
    .example-title {
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 4px;
    }
    .example-result {
      color: #059669;
      font-weight: 600;
      margin-top: 4px;
    }
    .tip-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 4px;
      padding: 6px 10px;
      margin-top: 8px;
      font-size: 8pt;
      color: #92400e;
    }
    .faq-box {
      margin-top: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 8pt;
    }
    .faq-q {
      font-weight: 700;
      color: #1e293b;
    }
    .faq-a {
      color: #475569;
      margin-top: 2px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 20px;
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1 class="main-title">${title}</h1>
      <p class="subtitle">Manual de inducción y consulta rápida para el equipo de ${companyName}</p>
    </div>
    <div class="meta-box">
      <div><strong>Organización:</strong> ${companyName}</div>
      <div><strong>Emisión:</strong> ${todayStr}</div>
      <div><strong>Secciones:</strong> ${sections.length} temas</div>
    </div>
  </div>

  ${sections
    .map(
      (section) => `
    <div class="section-card">
      <h2 class="section-title">${section.title}</h2>
      <p class="section-summary">${section.summary}</p>

      <ol class="steps-list">
        ${section.steps
          .map(
            (step) => `
          <li>
            <div class="step-title">${step.title}</div>
            <div class="step-desc">${step.description}</div>
          </li>
        `,
          )
          .join('')}
      </ol>

      ${
        includeExamples && section.examples && section.examples.length > 0
          ? section.examples
              .map(
                (ex) => `
          <div class="example-box">
            <div class="example-title">★ Caso Práctico: «${ex.goal}»</div>
            <ol style="margin: 3px 0; padding-left: 18px;">
              ${ex.setup.map((s) => `<li>${s}</li>`).join('')}
            </ol>
            <div class="example-result">➜ Resultado: ${ex.result}</div>
          </div>
        `,
              )
              .join('')
          : ''
      }

      ${
        includeTips && section.tips && section.tips.length > 0
          ? section.tips
              .map(
                (tip) => `
          <div class="tip-box">
            <strong>💡 Consejo:</strong> ${tip}
          </div>
        `,
              )
              .join('')
          : ''
      }

      ${
        includeFaq && section.faq && section.faq.length > 0
          ? section.faq
              .map(
                (f) => `
          <div class="faq-box">
            <div class="faq-q">❓ ${f.question}</div>
            <div class="faq-a">${f.answer}</div>
          </div>
        `,
              )
              .join('')
          : ''
      }
    </div>
  `,
    )
    .join('')}

  <div class="footer">
    ${companyName} • Sistema de Gestión y Administración 4G • Documento de consulta interna • ${todayStr}
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }
}
