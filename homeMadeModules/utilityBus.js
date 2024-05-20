const fs = require('node:fs');

const allTrips = require('../json_data/trips.json');
const stopTimesData = require('../json_data/stop_times.json');
const routes = require('../json_data/routes.json');
const calendar = require('../json_data/calendar.json');
const calendarDates = require('../json_data/calendar_dates.json');

function getStopsForTrip(tripId) { //On récupère les arrêts d'un voyage
    const StopsForTrip = [];

    const stopsDataForTrop = stopTimesData.filter(stopTime => stopTime.trip_id === tripId);

    stopsDataForTrop.forEach(stopTime => {
        StopsForTrip.push(stopTime.stop_id);
    });

    return StopsForTrip;
}

function getStopsInfos(stopId) { //On récupère les informations d'un arrêt
    const stops = require('../json_data/stops.json');
    const stopInfos = stops.find(stop => stop.stop_id === stopId);

    return stopInfos;
}

function getTripsDuration(tripId) { //On récupère la durée d'un voyage en minutes
    //On récupère les horaires de passage aux arrêts
    const stopTimesForTrip = stopTimesData.filter(stopTime => stopTime.trip_id === tripId);
    //On récupère le tout premier horaire de passage
    const firstStopTime = stopTimesForTrip[0].departure_time;
    //On récupère le tout dernier horaire de passage
    const lastStopTime = stopTimesForTrip[stopTimesForTrip.length - 1].arrival_time;

    //On convertit les horaires (sous formes HH:MM:SS) en format Date
    const firstDate = new Date(`01/01/1970 ${firstStopTime}`);
    const lastDate = new Date(`01/01/1970 ${lastStopTime}`);

    //On calcule la durée du voyagen, et on le convertit en minutes
    const duration = (lastDate - firstDate) / 1000 / 60;

    return {
        trip_id: tripId,
        duration: duration,
        unit: 'minutes'
    }
}

function getLinesThroughStop(stopId) { //On récupère les lignes passant par un arrêt
    const lines = [];
    const trips = allTrips.filter(trip => {
        const stops = getStopsForTrip(trip.trip_id);
        return stops.includes(stopId);
    });

    trips.forEach(trip => {
        if (!lines.includes(trip.route_id)) {
            lines.push(trip.route_id);
        }
    });

    return lines;
}

function getRouteInfos(routeId) { //On récupère les informations d'une ligne
    const routeInfos = routes.find(route => route.route_id === routeId);

    return routeInfos;
}

function getTripsThroughStop(stopId) { //On récupère les voyages passant par un arrêt
    var trips = [];
    allTrips.filter(trip => {
        //On récupère les arrêts du voyage
        const stops = getStopsForTrip(trip.trip_id);
        //On vérifie si l'arrêt est dans la liste des arrêts du voyage
        if (stops.includes(stopId)) {
            trips.push(trip.trip_id);
        }
    });

    return trips;
}

//On récupère les prochains bus à un arrêt, on classe les bus par l'heure
function getNextBusesStop(stopId, dateArg) {
    const nextBuses = [];
    const trips = allTrips.filter(trip => {
        const stops = getStopsForTrip(trip.trip_id);
        return stops.includes(stopId);
    });

    let date;
    if(dateArg) {
        date = new Date(parseInt(dateArg));
        console.log("Argument:" + dateArg)
        console.info("Updated date: " + date);
    } else {
        date = new Date()
    }

    const day = date.toLocaleDateString('en-US', { weekday: 'long' });

    function addZeros(i) {
        if (i < 10) {
            i = "0" + i;
        }
        return i;
    }

    const currentTimeStamp = date;
    const currentDate = currentTimeStamp.getFullYear() + '' + addZeros(currentTimeStamp.getMonth() + 1) + '' + addZeros(currentTimeStamp.getDate());

    trips.forEach(trip => {
        const stopTimesForTrip = stopTimesData.filter(stopTime => stopTime.trip_id === trip.trip_id);
        const nextStopTime = stopTimesForTrip.find(stopTime => stopTime.stop_id === stopId);
        
        calendar.forEach(calendar => {
            if(calendar.service_id === trip.service_id) {

                const result = calendarDates.find(exception => 
                    exception.service_id === trip.service_id && exception.date === currentDate
                );

                if(result?.exception_type == 2) {
                    return;
                } else {
                    if (calendar[day.toLowerCase()] == 1) {
                        const busTime = new Date(`${currentTimeStamp.getFullYear()}-${addZeros(currentTimeStamp.getMonth() + 1)}-${addZeros(currentTimeStamp.getDate())} ${nextStopTime.arrival_time}`);
                        if (busTime >= currentTimeStamp) {
                            nextBuses.push({
                                trip_id: trip.trip_id,
                                route_id: trip.route_id,
                                calendar: trip.service_id,
                                arrival_time: nextStopTime.arrival_time,
                                trip_headsign: trip.trip_headsign,
                            });
                        } 
                    }
                }
            }
        });
    });

    nextBuses.sort((a, b) => {
        if (a.arrival_time < b.arrival_time) {
            return -1;
        }
        if (a.arrival_time > b.arrival_time) {
            return 1;
        }
        return 0;
    });

    return nextBuses;
}

function getLineName(routeId) { //On récupère le nom d'une ligne
    const routeInfos = getRouteInfos(routeId);
    return routeInfos.route_short_name;
}

function getLineInfos(tripId) { //On récupère les informations d'une ligne, par son tripId
    const trip = allTrips.find(trip => trip.trip_id === tripId);
    const routeInfos = getRouteInfos(trip.route_id);

    return routeInfos;
}

function getTripInfos(tripId) { //On récupère les informations d'un voyage
    const trip = allTrips.find(trip => trip.trip_id === tripId);
    return trip;
}

function getStopName(stopId) { //On récupère le nom d'un arrêt
    const stopInfos = getStopsInfos(stopId);
    return stopInfos.stop_name;
}

function getLastStop(tripId) { //On récupère le dernier arrêt d'un voyage
    const stops = getStopsForTrip(tripId);
    return stops[stops.length - 1];
}
  
module.exports = {
    getLinesThroughStop,
    getNextBusesStop,
    getStopsForTrip,
    getStopsInfos,
    getTripsDuration,
    getRouteInfos,
    getLineName,
    getStopName,
    getLastStop,
    getTripsThroughStop,
    getLineInfos,
    getTripInfos
};
