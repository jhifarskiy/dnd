const mongoose = require('mongoose');

const WorldMapSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        default: 'main_world_map' 
    },
    backgroundUrl: { type: String, default: '' },
});

const WorldMap = mongoose.model('WorldMap', WorldMapSchema);
module.exports = WorldMap;