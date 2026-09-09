#!/usr/bin/env tsx
/**
 * Seed Script für Pfäffikon Prototype
 * 
 * Lädt NUR die Prototyp-Daten aus:
 * - Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1.geojson
 * 
 * WICHTIG: Lädt KEINE Rom-Daten!
 */

import { db } from '../src/db/index.js';
import { worldObject, questDefinition, questStep, player, team } from '../src/db/schema.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GeoJSON-Datei einlesen
// Prüfe erst ob die Datei im Docker-Mount existiert, sonst nehme lokalen Pfad
const DOCKER_GEOJSON_PATH = '/app/data/prototype-gameobjects.geojson';
const LOCAL_GEOJSON_PATH = join(__dirname, '../../../docs/Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1 (1).geojson');

import { existsSync } from 'fs';
const GEOJSON_PATH = existsSync(DOCKER_GEOJSON_PATH) ? DOCKER_GEOJSON_PATH : LOCAL_GEOJSON_PATH;

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, any>;
}

interface GeoJSONFeatureCollection {
  type: string;
  features: GeoJSONFeature[];
  metadata?: Record<string, any>;
}

async function seedPrototype() {
  console.log('🧪 Starting Pfäffikon Prototype Seeding...\n');

  try {
    // 1. GeoJSON einlesen
    console.log('📖 Reading GeoJSON file...');
    const geojsonContent = readFileSync(GEOJSON_PATH, 'utf-8');
    const geojson: GeoJSONFeatureCollection = JSON.parse(geojsonContent);
    
    console.log(`✓ Loaded ${geojson.features.length} features from GeoJSON\n`);

    // 2. Test-Team erstellen
    console.log('👥 Creating prototype test team...');
    
    const [testTeam] = await db.insert(team)
      .values({
        id: 'team-prototype-test-01',
        name: 'Pfäffikon Test Team',
        denarii: 200, // Start-Denare wie in Spec
        glory: 0,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: team.id,
        set: {
          denarii: 200,
          glory: 0,
        },
      })
      .returning();

    console.log(`✓ Team created: ${testTeam.name} (${testTeam.id})`);

    // 3. Test-Spieler erstellen
    console.log('🎮 Creating test players...');
    
    const testPlayers = [
      {
        id: 'player-prototype-01',
        username: 'prototyp_player1',
        passwordHash: '$2a$10$TEST_HASH_1',  // Dummy Hash
        teamId: testTeam.id,
        role: 'PLAYER' as const,
        hpCurrent: 100,
        hpMax: 100,
      },
      {
        id: 'player-prototype-02',
        username: 'prototyp_player2',
        passwordHash: '$2a$10$TEST_HASH_2',
        teamId: testTeam.id,
        role: 'PLAYER' as const,
        hpCurrent: 100,
        hpMax: 100,
      },
      {
        id: 'player-prototype-gm',
        username: 'prototyp_gm',
        passwordHash: '$2a$10$TEST_HASH_GM',
        teamId: null,
        role: 'GAME_MASTER' as const,
        hpCurrent: 100,
        hpMax: 100,
      },
    ];

    for (const p of testPlayers) {
      await db.insert(player)
        .values(p)
        .onConflictDoUpdate({
          target: player.id,
          set: { teamId: p.teamId },
        });
      console.log(`  ✓ ${p.username} (${p.role})`);
    }

    // 4. WorldObjects aus GeoJSON laden
    console.log('\n🗺️  Loading WorldObjects from GeoJSON...');
    
    let loadedCount = 0;
    let skippedCount = 0;

    for (const feature of geojson.features) {
      const props = feature.properties;
      const featureType = props.feature_type;

      // Nur relevante Feature-Types laden
      if (!['location_candidate', 'enemy_encounter', 'store_definition', 'revival_area', 'boss_encounter'].includes(featureType)) {
        skippedCount++;
        continue;
      }

      // Koordinaten extrahieren
      let lat: number, lng: number;
      if (feature.geometry.type === 'Point') {
        [lng, lat] = feature.geometry.coordinates as number[];
      } else if (feature.geometry.type === 'Polygon') {
        // Nutze Zentroid (erste Koordinate des ersten Rings)
        const coords = feature.geometry.coordinates as number[][][];
        [lng, lat] = coords[0][0];
      } else {
        console.log(`  ⚠️  Skipping ${featureType} (unsupported geometry: ${feature.geometry.type})`);
        skippedCount++;
        continue;
      }

      // WorldObject Type bestimmen
      let objectType: string;
      if (featureType === 'location_candidate') {
        const roles = props.support_roles || [];
        if (roles.includes('QUEST_PICKUP') || roles.includes('QUEST_OBJECTIVE')) {
          objectType = 'QUEST_LOCATION';
        } else if (roles.includes('UNIQUE_WORLD_ENEMY')) {
          objectType = 'ENEMY';
        } else if (roles.includes('STORE_LOCATION')) {
          objectType = 'STORE';
        } else if (roles.includes('REVIVE_POINT')) {
          objectType = 'REVIVE_POINT';
        } else if (roles.includes('WORLD_BOSS_LOCATION')) {
          objectType = 'BOSS';
        } else {
          objectType = 'LOCATION';
        }
      } else if (featureType === 'enemy_encounter') {
        objectType = 'ENEMY';
      } else if (featureType === 'store_definition') {
        objectType = 'STORE';
      } else if (featureType === 'revival_area') {
        objectType = 'REVIVE_POINT';
      } else if (featureType === 'boss_encounter') {
        objectType = 'BOSS';
      } else {
        objectType = 'LOCATION';
      }

      const externalId = props.candidate_id || props.encounter_id || props.store_id || props.boss_event_id || `proto-${loadedCount}`;

      await db.insert(worldObject)
        .values({
          externalId,
          type: objectType,
          name: props.name || 'Unnamed Location',
          lat,
          lng,
          interactionRadiusM: props.standard_interaction_radius_m || props.interaction_radius_m || 15,
          exitRadiusM: props.exit_radius_m || 25,
          discoveryRadiusM: props.discovery_radius_m || 55,
          aggroRadiusM: props.aggro_radius_m || 20,
          publishable: props.publishable !== false, // Auch unpublishable Prototyp-Daten laden
          metadata: {
            featureType,
            day: props.day || 'PROTOTYPE',
            prototype: true,
            ...props,
          },
        })
        .onConflictDoUpdate({
          target: worldObject.externalId,
          set: {
            name: props.name || 'Unnamed Location',
            lat,
            lng,
            metadata: {
              featureType,
              day: props.day || 'PROTOTYPE',
              prototype: true,
              ...props,
            },
          },
        });

      loadedCount++;
      console.log(`  ✓ ${props.name || externalId} (${objectType})`);
    }

    console.log(`\n✅ Loaded ${loadedCount} WorldObjects (skipped ${skippedCount})`);

    // 5. Quest PT-Q01 erstellen
    console.log('\n📜 Creating Quest PT-Q01...');

    const [quest] = await db.insert(questDefinition)
      .values({
        externalId: 'PT-Q01',
        title: 'Die drei Siegel der Schildwacht',
        description: 'Konrad prüft, ob das Team eine Schutzfolge erinnert, als Einheit drei Posten erreicht und den Schatten des Passetto besiegt.',
        day: 'PROTOTYPE',
        sequence: 1,
        requiredTeamSize: 2,
        publishable: false, // Prototyp
      })
      .onConflictDoUpdate({
        target: questDefinition.externalId,
        set: {
          title: 'Die drei Siegel der Schildwacht',
          publishable: false,
        },
      })
      .returning();

    console.log(`✓ Quest: ${quest.title}`);

    // 6. Quest Steps
    console.log('📋 Creating Quest Steps...');

    const steps = [
      {
        externalId: 'PT-Q01-S01',
        sequence: 1,
        flowPhase: 'PICKUP',
        stepActionType: 'REACH_LOCATION',
        targetRef: 'place_pt_pfaeffikon_q1',
      },
      {
        externalId: 'PT-Q01-S02',
        sequence: 2,
        flowPhase: 'SETUP',
        stepActionType: 'DIALOGUE',
        targetRef: 'npc_konrad_schildwacht',
      },
      {
        externalId: 'PT-Q01-S04',
        sequence: 4,
        flowPhase: 'OBJECTIVE',
        stepActionType: 'REACH_LOCATION',
        targetRef: 'place_pt_pfaeffikon_q2',
      },
      {
        externalId: 'PT-Q01-S05',
        sequence: 5,
        flowPhase: 'OBJECTIVE',
        stepActionType: 'QUIZ',
        targetRef: 'quiz_three_symbols',
      },
      {
        externalId: 'PT-Q01-S06',
        sequence: 6,
        flowPhase: 'OBJECTIVE',
        stepActionType: 'REACH_LOCATION',
        targetRef: 'place_pt_pfaeffikon_q3',
      },
      {
        externalId: 'PT-Q01-S08',
        sequence: 8,
        flowPhase: 'CLIMAX',
        stepActionType: 'DEFEAT_ENEMY',
        targetRef: 'PT-QE-01',
      },
      {
        externalId: 'PT-Q01-S10',
        sequence: 10,
        flowPhase: 'RESOLUTION',
        stepActionType: 'REWARD',
        targetRef: null,
      },
    ];

    for (const step of steps) {
      await db.insert(questStep)
        .values({
          questDefinitionId: quest.id,
          ...step,
        })
        .onConflictDoNothing();
      console.log(`  ✓ Step ${step.sequence}: ${step.stepActionType}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ Prototype Seeding Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  - Team: ${testTeam.name}`);
    console.log(`  - Players: ${testPlayers.length}`);
    console.log(`  - WorldObjects: ${loadedCount}`);
    console.log(`  - Quest: ${quest.title}`);
    console.log(`  - Steps: ${steps.length}`);
    console.log('');
    console.log('🔐 Test Credentials:');
    console.log('  Player 1: prototyp_player1 / test123');
    console.log('  Player 2: prototyp_player2 / test123');
    console.log('  GM:       prototyp_gm / test123');
    console.log('');
    console.log('🌐 Access:');
    console.log('  Backend:  http://localhost:3001');
    console.log('  Frontend: http://localhost:5175');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

// Execute
seedPrototype()
  .then(() => {
    console.log('\n✨ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });
