const ink = '#1C1A16';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[character] ?? character;
  });
}

export function emailTemplate(input: {
  title: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  unsubscribe?: { label: string; href: string };
  footnote?: string;
}) {
  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:${ink};font:16px/1.65 Arial,'Helvetica Neue',sans-serif">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
  const button = input.cta
    ? `<p style="margin:28px 0"><a href="${escapeHtml(input.cta.href)}" style="display:inline-block;min-height:48px;padding:15px 24px;border-radius:10px;background:#2F4A12;color:#fff;text-decoration:none;font:700 16px/1.2 Arial,'Helvetica Neue',sans-serif">${escapeHtml(input.cta.label)}</a></p>`
    : '';
  const footnote = input.footnote
    ? `<p style="margin:24px 0 0;color:#5E584D;font:13px/1.5 Arial,'Helvetica Neue',sans-serif">${escapeHtml(input.footnote)}</p>`
    : '';
  const unsubscribe = input.unsubscribe
    ? `<p style="margin:20px 0 0;color:#5E584D;font:12px/1.5 Arial,'Helvetica Neue',sans-serif"><a href="${escapeHtml(input.unsubscribe.href)}" style="color:#2F4A12">${escapeHtml(input.unsubscribe.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(input.title)}</title></head><body style="margin:0;padding:24px 12px;background:#FFFBF2"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto"><tr><td style="padding:0 0 14px 4px;color:#2F4A12;font:700 20px/1.2 Arial,'Helvetica Neue',sans-serif">Open Slot</td></tr><tr><td style="padding:30px 28px;background:#fff;border:1px solid #DDD6C4;border-radius:16px"><h1 style="margin:0 0 22px;color:${ink};font:700 24px/1.25 Arial,'Helvetica Neue',sans-serif">${escapeHtml(input.title)}</h1>${paragraphs}${button}${footnote}${unsubscribe}</td></tr><tr><td style="padding:18px 4px;color:#5E584D;font:12px/1.5 Arial,'Helvetica Neue',sans-serif">Open Slot · <a href="https://www.openslot.io.vn" style="color:#2F4A12">www.openslot.io.vn</a><br>Nếu cần hỗ trợ, trả lời email này hoặc liên hệ hotro@openslot.vn.</td></tr></table></body></html>`;
  const text = [
    'Open Slot',
    '',
    input.title,
    '',
    ...input.paragraphs,
    ...(input.cta ? ['', `${input.cta.label}: ${input.cta.href}`] : []),
    ...(input.footnote ? ['', input.footnote] : []),
    ...(input.unsubscribe ? ['', `${input.unsubscribe.label}: ${input.unsubscribe.href}`] : []),
    '',
    'Open Slot · https://www.openslot.io.vn',
    'Hỗ trợ: hotro@openslot.vn',
  ].join('\n');
  return { html, text };
}
