const eventsRouter = require('express').Router();
const asyncHandler = require('express-async-handler');
const Event = require('../models/event');
const db = require('../db');
const requireCurrentUser = require('../middlewares/requireCurrentUser');

eventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      res.send(await Event.findAll());
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

const getAdditionalData = async (eventId) => {
  const eventCurrentSkills = await Event.eventCurrentSkills(eventId);
  const eventSkillsToAcquire = await Event.eventSkillsToAcquire(eventId);
  const eventTags = await Event.eventTags(eventId);
  return { eventCurrentSkills, eventSkillsToAcquire, eventTags };
};

eventsRouter.get(
  '/upcoming',
  asyncHandler(async (req, res) => {
    try {
      const upcoming = await Event.findByDate(new Date());
      const updatedUpcoming = await Promise.all(
        upcoming.map(async (e) => {
          const additionalData = await getAdditionalData(e.id);
          const updatedData = { ...e, ...additionalData };
          return updatedData;
        })
      );
      res.send(updatedUpcoming);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

eventsRouter.get(
  '/tags',
  asyncHandler(async (req, res) => {
    try {
      const tags = await Event.findTags();
      res.send(tags);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

eventsRouter.get(
  '/popular',
  asyncHandler(async (req, res) => {
    try {
      const popular = await db.event.findMany({
        include: {
          owner: true,
        },
        orderBy: {
          popularity: 'desc',
        },
        take: 10,
      });
      const updatedPopular = await Promise.all(
        popular.map(async (e) => {
          const additionalData = await getAdditionalData(e.id);
          const updatedData = { ...e, ...additionalData };
          return updatedData;
        })
      );
      res.send(updatedPopular);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

eventsRouter.post(
  '/search/',
  asyncHandler(async (req, res) => {
    const { searchValue } = req.body;
    try {
      const searchedEvents = await Event.findByQuery(searchValue);
      res.send(searchedEvents);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

eventsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      const event = await Event.findUnique(id);
      if (!Object.entries(event).length)
        res.status(200).send(`Event (${id}) not found`);
      else {
        const eventId = parseInt(id, 10);
        const additionalData = await getAdditionalData(eventId);
        const updatedData = { ...event, ...additionalData };
        res.send(updatedData);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

eventsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      const deletedEvent = await Event.destroy(id);
      res.status(201).send(deletedEvent);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

eventsRouter.post(
  '/',
  requireCurrentUser,
  asyncHandler(async (req, res) => {
    const { id } = req.currentUser;

    const {
      location,
      image,
      duration,
      name,
      date,
      description,
      online,
      tag,
      popularity,
      chosenSkills = [],
      chosenNewSkills = [],
    } = req.body;

    try {
      const newEvent = await Event.createEvent({
        ownerId: id,
        location,
        image,
        name,
        duration: parseInt(duration, 10),
        date: new Date(date),
        description,
        online,
        popularity,
      });
      await Event.linkTags({ eventId: newEvent.id, tagId: parseInt(tag, 10) });
      await Event.linkCurrentSkills({
        eventId: newEvent.id,
        chosenSkills,
      });
      await Event.linkSkillsToAcquire({
        eventId: newEvent.id,
        chosenNewSkills,
      });
      res.status(200).send(newEvent);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  })
);

module.exports = eventsRouter;
