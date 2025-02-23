import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { DateTime, Duration } from 'luxon';
import { WebSocketServer } from 'ws';


const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const timeZone = 'UTC'

const port = 3000;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

const loadBuses = async () => {
    const data = await readFile(path.join(__dirname, 'buses.json'), 'utf-8');
    return JSON.parse(data);
};

const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
    const now = DateTime.now().setZone(timeZone);
    const [hour, minute] = firstDepartureTime.split(':').map(n => Number(n));

    let departure = DateTime.now().set({ hour, minute, second: 0, millisecond: 0 }).setZone(timeZone);

    if (now > departure) {
        departure = departure.plus({ minutes: frequencyMinutes });
    }

    const endOfDay = DateTime.now().set({ hour: 23, minute: 59, second: 59 }).setZone(timeZone);

    if (departure > endOfDay) {
        departure = departure.startOf('day').plus({ days: 1 }).set({ hour, minute });
    }

    while (now > departure) {
        departure = departure.plus({ minutes: frequencyMinutes });

        if (departure > endOfDay) {
            departure = departure.startOf('day').plus({ days: 1 }).set({ hour, minute });
        }
    }

    return departure;
};

const sendUpdatedData = async () => {
    const buses = await loadBuses();
    const now = DateTime.now().setZone(timeZone);

    const updatedBuses = buses.map((bus) => {
        const nextDeparture = getNextDeparture(bus.firstDepartureTime, bus.frequencyMinutes);
        const timeRemaining = Duration.fromMillis(nextDeparture.diff(now).toMillis());

        return {
            ...bus,
            nextDeparture: {
                date: nextDeparture.toFormat('yyyy-MM-dd'),
                time: nextDeparture.toFormat('HH:mm:ss'),
                remaining: timeRemaining.toFormat('hh:mm:ss'),
            }
        }
    });

    return updatedBuses;
};

const sortBuses = (buses) => {
    return [...buses].sort((a, b) => {
        const aBusDateTime = DateTime.fromISO(`${a.nextDeparture.date}T${a.nextDeparture.time}Z`);
        const bBusDateTime = DateTime.fromISO(`${b.nextDeparture.date}T${b.nextDeparture.time}Z`);

        return aBusDateTime - bBusDateTime;
    });
};

app.get('/next-departure', async (req, res) => {
    try {
        const updatedBuses = await sendUpdatedData();
        const sortDepartureBusses = sortBuses(updatedBuses);

        res.json(sortDepartureBusses);
    } catch {
        res.send('Error');
    }
});

const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);

    const sendUpdates = async () => {
        try {
            const updatedBuses = await sendUpdatedData();
            const sortDepartureBusses = sortBuses(updatedBuses);

            ws.send(JSON.stringify(sortDepartureBusses));
        } catch (error) {
            console.error(`Error websocket connection: ${error}`);
        }
    };

    const intervalId = setInterval(sendUpdates, 1000);

    ws.on('close', () => {
        clearInterval(intervalId);
        clients.delete(ws);
    });
});

const server = app.listen(port, () => {
    console.log(`Сервер запущен! http://localhost:${port}/`);
});

server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});