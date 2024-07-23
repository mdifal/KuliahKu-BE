// dateUtils.js

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  

  function formatDateTime(dateTime) {
    // Mendapatkan komponen tanggal, bulan, tahun, jam, menit, dan detik
    const seconds = dateTime._seconds || 0;
    const milliseconds = dateTime._nanoseconds / 1000000 || 0;
    const date = new Date(seconds * 1000 + milliseconds);
  
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const secondsString = String(date.getSeconds()).padStart(2, '0');
    const millisecondsString = String(date.getMilliseconds()).padStart(3, '0');
    
    // Membuat string dengan format yang diinginkan
    return `${year}-${month}-${day} ${hours}:${minutes}:${secondsString}.${millisecondsString}`;
  }
  module.exports = { formatDate, formatDateTime };
  