const fs = require('fs');
const filepath = 'c:\\\\Users\\\\farit\\\\Downloads\\\\MILLENNIUM HYDRAULICS\\\\frontend\\\\src\\\\components\\\\InvoicePreview.jsx';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const dynamicTableStyles = React\.useMemo[\s\S]*?\}, \[items\.length\]\);/, `const dynamicTableStyles = React.useMemo(() => {
    const len = items.length;
    if (len <= 5) return { '--r-pad': '4px 6px', '--f-row': '11px', '--f-hdr': '12px', '--g-mar': '8px', '--f-title': '30px', '--s-logo': '40px', '--f-sm': '10px', '--f-xs': '9px' };
    if (len <= 10) return { '--r-pad': '3px 4px', '--f-row': '10px', '--f-hdr': '11px', '--g-mar': '6px', '--f-title': '26px', '--s-logo': '36px', '--f-sm': '9px', '--f-xs': '8px' };
    if (len <= 15) return { '--r-pad': '2px 3px', '--f-row': '9px', '--f-hdr': '10px', '--g-mar': '4px', '--f-title': '22px', '--s-logo': '30px', '--f-sm': '8px', '--f-xs': '7px' };
    if (len <= 20) return { '--r-pad': '1px 2px', '--f-row': '8px', '--f-hdr': '9px', '--g-mar': '2px', '--f-title': '20px', '--s-logo': '24px', '--f-sm': '7.5px', '--f-xs': '6.5px' };
    return { '--r-pad': '0px 1px', '--f-row': '7.5px', '--f-hdr': '8.5px', '--g-mar': '1px', '--f-title': '18px', '--s-logo': '20px', '--f-sm': '7px', '--f-xs': '6px' };
  }, [items.length]);`);

content = content.replace(/marginBottom: '8px'/g, "marginBottom: 'var(--g-mar)'");
content = content.replace(/marginBottom: '10px'/g, "marginBottom: 'var(--g-mar)'");
content = content.replace(/marginTop: '10px'/g, "marginTop: 'var(--g-mar)'");
content = content.replace(/marginTop: '20px'/g, "marginTop: 'var(--g-mar)'");
content = content.replace(/paddingTop: '10px'/g, "paddingTop: 'var(--g-mar)'");
content = content.replace(/padding: '4px'/g, "padding: 'var(--r-pad)'");
content = content.replace(/padding: '4px 8px'/g, "padding: 'var(--r-pad)'");
content = content.replace(/padding: '2px 4px'/g, "padding: 'var(--r-pad)'");
content = content.replace(/padding: '4px 6px'/g, "padding: 'var(--r-pad)'");
content = content.replace(/padding: '6px 15px'/g, "padding: 'var(--r-pad)'");
content = content.replace(/padding: '2px 8px'/g, "padding: 'var(--r-pad)'");
content = content.replace(/fontSize: '10px'/g, "fontSize: 'var(--f-row)'");
content = content.replace(/fontSize: '11px'/g, "fontSize: 'var(--f-sm)'");
content = content.replace(/fontSize: '12px'/g, "fontSize: 'var(--f-sm)'");
content = content.replace(/fontSize: '13px'/g, "fontSize: 'var(--f-row)'");
content = content.replace(/fontSize: '14px'/g, "fontSize: 'var(--f-sm)'");
content = content.replace(/fontSize: '16px'/g, "fontSize: 'var(--f-hdr)'");
content = content.replace(/fontSize: '32px'/g, "fontSize: 'var(--f-title)'");
content = content.replace(/fontSize: '8px'/g, "fontSize: 'var(--f-xs)'");
content = content.replace(/fontSize: '9px'/g, "fontSize: 'var(--f-xs)'");
content = content.replace(/width: '40px'/g, "width: 'var(--s-logo)'");
content = content.replace(/height: '40px'/g, "height: 'var(--s-logo)'");

fs.writeFileSync(filepath, content);
console.log('Scaling fix applied successfully!');
