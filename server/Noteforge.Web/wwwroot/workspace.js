// Browser-only helpers. Workspace state and behavior live in Blazor/C#.
window.noteforge = (() => {
    let reference, editor, dirty = false, lastDialog, returnFocus;
    const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    const keydown = event => {
        if (event.target.matches?.('.page-title') && event.key === 'Enter') event.preventDefault();
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); reference?.invokeMethodAsync('OpenSearch'); }
        if (event.target.matches?.('.block-text') && ((event.ctrlKey && event.key === 'Enter') || (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)))) event.preventDefault();
        if (event.target.matches?.('.block-text') && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.isComposing) {
            event.preventDefault();
            const field = event.target;
            if (!field.value.startsWith('/')) editor?.invokeMethodAsync('SplitBlock', field.id.slice(6), field.value, field.selectionStart, field.selectionEnd);
        }
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog && event.key === 'Tab') {
            const items = [...dialog.querySelectorAll('button, input, select, textarea, a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
            if (!items.length) return;
            if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
        }
    };
    const hashChanged = () => { try { reference?.invokeMethodAsync('SelectFromHash', decodeURIComponent(location.hash.slice(1))); } catch {} };
    return {
        registerEditor(dotnet) { editor = dotnet; },
        initialize(dotnet) {
            reference = dotnet;
            const dark = localStorage.getItem('noteforge-theme') === 'dark';
            document.documentElement.dataset.theme = dark ? 'dark' : 'light';
            window.addEventListener('beforeunload', beforeUnload);
            document.addEventListener('keydown', keydown);
            window.addEventListener('hashchange', hashChanged);
            let page = ''; try { page = decodeURIComponent(location.hash.slice(1)); } catch {}
            return { mobile: innerWidth < 760, dark, page };
        },
        refresh(unsaved) {
            dirty = unsaved;
            for (const area of document.querySelectorAll('.block-text, .page-title')) { area.style.height = 'auto'; area.style.height = `${area.scrollHeight}px`; }
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog && dialog !== lastDialog) { returnFocus = document.activeElement; (dialog.querySelector('input, textarea, select') || dialog.querySelector('button'))?.focus(); }
            else if (!dialog && lastDialog) returnFocus?.focus?.();
            lastDialog = dialog;
        },
        navigate(id) { history.replaceState(null, '', '#' + encodeURIComponent(id)); document.querySelector('.document-scroll')?.scrollTo(0, 0); return innerWidth < 760; },
        focus(id) { requestAnimationFrame(() => document.getElementById(id)?.focus()); },
        theme(dark) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('noteforge-theme', dark ? 'dark' : 'light'); },
        download(name, text, type) {
            const url = URL.createObjectURL(new Blob([text], { type }));
            const link = document.createElement('a'); link.download = name.replace(/[<>:"/\\|?*]/g, '_'); link.href = url; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        dispose() { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('hashchange', hashChanged); document.removeEventListener('keydown', keydown); reference = null; dirty = false; }
    };
})();
