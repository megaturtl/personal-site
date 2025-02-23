module.exports = {
    parseDate: (dateString) => {
        return new Date(dateString);
    },
    
    formatDate: (date) => {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }
}; 