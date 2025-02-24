const fetchBusData = async () => {
    try {
        const response = await fetch('/next-departure');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error(`Error fetching bus data: ${error}`);
    }
};

const formatDate = (date) => date.toISOString().split('T')[0];
const formatTime = (date) => date.toTimeString().split(' ')[0].slice(0, 5);

const getTimeRemainingSeconds = (departureTime) => {
    const now = new Date();
    const timeDifference = departureTime - now;
    
    return Math.floor(timeDifference / 1000);
};

const renderBusData = (buses) => {
    const tableBody = document.querySelector('#bus-table tbody');
    tableBody.innerText = '';
    
    buses.forEach((bus) => {
        const row = document.createElement('tr');
        
        const nextDepartureDateTimeUTC = new Date(`${bus.nextDeparture.date}T${bus.nextDeparture.time}Z`);
        
        const remainingSeconds = getTimeRemainingSeconds(nextDepartureDateTimeUTC);
        
        const remainingTimeText = remainingSeconds < 60 ? 'Отправляется' : bus.nextDeparture.remaining;
        
        row.innerHTML = `
            <td>${bus.busNumber}</td>
            <td>${bus.startPoint} - ${bus.endPoint}</td>
            <td>${formatDate(nextDepartureDateTimeUTC)}</td>
            <td>${formatTime(nextDepartureDateTimeUTC)}</td>
            <td>${remainingTimeText}</td>
        `;
        
        tableBody.append(row);
    });
};

const initWebSocket = () => {
    const ws = new WebSocket(`wss://${location.host}`);
    
    ws.addEventListener('open', () => {
        console.log('Websocket open!');
    });
    
    ws.addEventListener('message', (event) => {
        const buses = JSON.parse(event.data);
        renderBusData(buses);
    });
    
    ws.addEventListener('error', (error) => {
        console.error(`Websocket error: ${error}`);
    });
    
    ws.addEventListener('close', () => {
        console.log(`Websocket connection close`);
    });
};

const updateCurrentTime = () => {
    const currentTime = document.querySelector('#current-time');
    const now = new Date();
    currentTime.textContent = now.toTimeString().split(' ')[0];
    
    setInterval(() => updateCurrentTime(), 1000);
    // setInterval(updateCurrentTime, 1000); short function
};

const init = async () => {
    const buses = await fetchBusData();
    renderBusData(buses);
    
    initWebSocket();
    
    updateCurrentTime();
};

init();

