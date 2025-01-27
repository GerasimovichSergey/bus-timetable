import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { DateTime } from 'luxon';


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
    const [hours, minutes] = firstDepartureTime.split(':').map(n => Number(n));

    let departure = DateTime.now().set({ hours, minutes }).setZone(timeZone);

    if (now > departure) {
        departure = departure.plus({ minutes: frequencyMinutes });
    }

    const endOfDay = DateTime.now().set({ hours: 23, minutes: 59, seconds: 59 }).setZone(timeZone);

    if (departure > endOfDay) {
        departure = departure.startOf('day').plus({ days: 1 }).set({ hours, minutes });
    }

    while (now > departure) {
        departure = departure.plus({ minutes: frequencyMinutes });

        if (departure > endOfDay) {
            departure = departure.startOf('day').plus({ days: 1 }).set({ hours, minutes });
        }
    }

    return departure;
};

const sendUpdatedData = async () => {
    const buses = await loadBuses();

    const updatedBuses = buses.map((bus) => {
        const nextDeparture = getNextDeparture(bus.firstDepartureTime, bus.frequencyMinutes);
        return {
            ...bus,
            nextDeparture: {
                date: nextDeparture.toFormat('yyyy-MM-dd'),
                time: nextDeparture.toFormat('HH:mm:ss'),
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

app.listen(port, () => {
    console.log(`Сервер запущен! ${port} порт`);
})