'use strict';
// Tiny user-agent parser (no dependency): device / os / browser for the admin panel.
function parse(ua = '') {
  const s = String(ua);
  const device = /iPad|Tablet/i.test(s) ? 'tablet' : /Mobi|Android|iPhone/i.test(s) ? 'mobile' : 'desktop';
  const os = /Windows/i.test(s) ? 'Windows' : /Android/i.test(s) ? 'Android' : /iPhone|iPad|iPod/i.test(s) ? 'iOS' : /Mac OS X/i.test(s) ? 'macOS' : /CrOS/i.test(s) ? 'ChromeOS' : /Linux/i.test(s) ? 'Linux' : 'other';
  const browser = /Edg\//i.test(s) ? 'Edge' : /OPR\//i.test(s) ? 'Opera' : /SamsungBrowser/i.test(s) ? 'Samsung' : /Chrome\//i.test(s) ? 'Chrome' : /Firefox\//i.test(s) ? 'Firefox' : /Safari\//i.test(s) ? 'Safari' : 'other';
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp/i.test(s) ? (/Instagram/i.test(s) ? 'Instagram' : /FBAN|FBAV/i.test(s) ? 'Facebook' : 'in-app') : '';
  return { device, os, browser, inApp };
}
module.exports = { parse };
