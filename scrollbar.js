(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        * { 
            -ms-overflow-style: none !important; 
            scrollbar-width: none !important; 
        } 
        *::-webkit-scrollbar { 
            display: none !important; 
        }
    `;
    document.documentElement.appendChild(style);
})();
