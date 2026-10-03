/**
 * =============================================================================
 * NARVOS PRIME - RÉGIONS DU JEU
 * =============================================================================
 * 4 régions avec leurs cartes de départ
 */

import { Region } from '../types/game.types';

export const NARVOS_REGIONS: Region[] = [
    {
        id: 'station_spatiale',
        name: 'STATION SPATIALE',
        description: "Le point d'entrée dans la galaxie Narvos.",
        startingMap: '/textures/dofus_maps/Station_Spatiale/station/station_spatiale_1.png',
        color: '#3b82f6',
        cities: [
            {
                id: 'station_centrale',
                name: 'Station Centrale',
                maps: ['/textures/dofus_maps/Station_Spatiale/station/station_spatiale_1.png']
            },
            {
                id: 'station_donjon',
                name: 'Secteur Abandonné',
                maps: ['/textures/dofus_maps/Station_Spatiale/donjon/Station_Spatiale_DONJON_01.png']
            }
        ]
    },
    {
        id: 'aquarys',
        name: 'AQUARYS',
        description: "La planète océanique des Akar'lys.",
        startingMap: '/textures/dofus_maps/AQUARYS/ville/AQUARYS_VILLE_01.png',
        color: '#0ea5e9',
        cities: [
            {
                id: 'aquarys_ville',
                name: "Cité d'Émeraude",
                maps: ['/textures/dofus_maps/AQUARYS/ville/AQUARYS_VILLE_01.png']
            },
            {
                id: 'aquarys_exterieur',
                name: 'Récifs Extérieurs',
                maps: ['/textures/dofus_maps/AQUARYS/exterieur_ville/AQUARYS_EXTERIEUR_VILLE_05.png']
            },
            {
                id: 'aquarys_donjon',
                name: 'Abysses',
                maps: ['/textures/dofus_maps/AQUARYS/donjon/entre_dojon.png']
            }
        ]
    },
    {
        id: 'desertica',
        name: 'DÉSERTICA',
        description: 'Le désert brûlant des Mezalayis.',
        startingMap: '/textures/dofus_maps/DÉSERTICA/ville/DESERTICA_VILLE_01.png',
        color: '#f59e0b',
        cities: [
            {
                id: 'desertica_ville',
                name: "Sable-d'Or",
                maps: ['/textures/dofus_maps/DÉSERTICA/ville/DESERTICA_VILLE_01.png']
            },
            {
                id: 'desertica_exterieur',
                name: 'Dunes Brûlantes',
                maps: ['/textures/dofus_maps/DÉSERTICA/exterieur_ville/DESERTICA_EXTERIEUR_01.png']
            },
            {
                id: 'desertica_donjon',
                name: 'Tombeau Ancien',
                maps: ['/textures/dofus_maps/DÉSERTICA/donjon/desertica_donjon_3.png']
            }
        ]
    },
    {
        id: 'fungaria',
        name: 'FUNGARIA',
        description: 'La forêt fongique des Zayan.',
        startingMap: '/textures/dofus_maps/FUNGARIA/ville/FUNGARIA_VILLE_01.png',
        color: '#a21caf',
        cities: [
            {
                id: 'fungaria_ville',
                name: 'Mycélium-Prime',
                maps: ['/textures/dofus_maps/FUNGARIA/ville/FUNGARIA_VILLE_01.png']
            },
            {
                id: 'fungaria_exterieur',
                name: 'Forêt des Spores',
                maps: ['/textures/dofus_maps/FUNGARIA/exterieur_ville/fungaria_exterior_10.png']
            },
            {
                id: 'fungaria_donjon',
                name: 'Caverne Fongique',
                maps: ['/textures/dofus_maps/FUNGARIA/donjon/FUNGARIA_DONJON_01.png']
            }
        ]
    }
];

// Helper pour obtenir une région par ID
export const getRegionById = (id: string): Region | undefined =>
    NARVOS_REGIONS.find(r => r.id === id);

// Région de départ par défaut
export const DEFAULT_REGION = NARVOS_REGIONS[0];
