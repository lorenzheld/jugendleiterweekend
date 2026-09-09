# Via Romae – Vibecoding-Brief für den Feldprototyp Pfäffikon ZH

Version 0.1 · Prototyp `PT-PFAEFFIKON-IM-BERG` · Gebiet «Im Berg»

## Ziel

Baue einen spielbaren Vertical Slice, der die risikoreichsten Systeme von *Via Romae* im Feld mit zwei aktiven Personen testet: GPS-Interaktion, eine vollständige Drei-Orte-Quest, Dialog und Multiple Choice, rundenbasierter Kampf, zwei Unique-Gegner, Store, Tod und Wiederbelebung, straßengebundene Zufallsspawns sowie einen mehrphasigen Weltboss.

Der vollständige Durchlauf ist auf **55–75 Minuten** ausgelegt. Die frühere Annahme von 15–20 Minuten deckt diesen Umfang nicht ab.

## Verbindliche Eingaben

1. `Via_Romae_GDD_v0.17_Teil_I-IX_Kapitel_1-42.docx` – autoritativ für Spielregeln.
2. `Via_Romae_Pfaeffikon_Prototype_Questdoc_v0.1.xlsx` – autoritativ für Ablauf, Texte, Quiz, Gegner, Store, Boss und Testfälle.
3. `Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1.geojson` – autoritativ für IDs, Koordinaten, Zonen, Radien und Straßenlinien.

Bei einem Konflikt gilt diese Reihenfolge. Fehlende Regeln nicht still erfinden, sondern als `TODO-DESIGN` markieren.

## Harte Grenzen

- Ausschließlich vorhandene Assets, Charaktere, Gegner, Items, Stances und Sounds aus dem Hauptspiel verwenden.
- Keine AR-, Bild- oder Objekterkennung.
- Keine Freitexteingabe als spielentscheidende Mechanik.
- Keine Innenräume, Eintrittstickets oder Öffnungszeiten-Abhängigkeit.
- Keine Turn-by-Turn-Navigation.
- Alle serverrelevanten Zustände und Belohnungen sind autoritativ und idempotent.
- Prototypdaten bleiben `publishable: false`; Pfäffikon ist kein Rom-Content.

## Spielmodule

| Modul | Dauer | Muss getestet werden |
|---|---:|---|
| A – Quest | 15–22 Min. | 3 GPS-Punkte, Dialog, Merkhinweis, Multiple Choice, Teampräsenz, Questkampf, Reconnect, einmalige Belohnung |
| B – Welt/Store/Tod | 25–35 Min. | Storekauf, 2 Unique-Gegner, Item-Revive, Downed, Team-Wipe, Verlust, Respawn, Zufallsspawns nur auf Straßen |
| C – Boss | 15–20 Min. | Ankündigung, 30-m-Beitritt, Teilnehmer-Lock, Runden, 3 Phasen, globale Reaktion, Beitrag, Rangbelohnung |

## GPS- und Interaktionskern

- Normale Quest-, Store- und Revive-Interaktion: **15 m ENTER**, **25 m EXIT**.
- Effektive Distanz: `max(0, measuredDistance - min(reportedAccuracy, 10 m))`.
- GPS-Messungen mit Genauigkeit über 50 m sind ungültig.
- Kritische räumliche Aktionen benötigen zwei aufeinanderfolgende frische gültige Messungen.
- Maximales Messalter: 8 s für Aggro/Bossbeitritt; 15 s für Dialog, Store und Objectives.
- Ein normales Questziel gilt nur, wenn beide aktiven Teammitglieder die Präsenzbedingung erfüllen.
- Client zeigt Rohdistanz, effektive Distanz, Genauigkeit und Grund einer blockierten Interaktion im Debug-Overlay.

## Quest `PT-Q01` – Die drei Siegel der Schildwacht

Verwende `npc_konrad_schildwacht`, `CP-QE-PASSETTO` und `qi_sigillum_guardiae`.

1. **Queststation Ost:** Konrad begrüßt das Team und gibt die Merkfolge **Schild → Speer → Standarte** vor.
2. **Queststation Mitte:** Multiple-Choice-Frage zur Reihenfolge. Richtige Antwort ist Option A. Bei Fehler erscheint ein Hinweis aus dem bereits gehörten Dialog; danach ist ein erneuter Versuch möglich.
3. **Queststation West:** kurzer Vorkampfdialog, danach Kampf gegen den **Schatten des Passetto**.
4. Nach Runde 1 wird im Playtest ein Client für ungefähr 20 Sekunden getrennt. Nach Reconnect müssen Kampf-ID, Runde, HP, Status und bereits gesperrte Aktion identisch rekonstruiert werden.
5. Abschlussbelohnung genau einmal: 55 Ruhm, 30 Denare, `qi_sigillum_guardiae`.

Die Quest darf keinen angeblich vor Ort sichtbaren historischen Hinweis voraussetzen. Ihr Hinweis stammt eindeutig aus dem Dialog.

## Rundenkampf

- Serverzustand ist maßgeblich; der Client sendet nur Commands.
- Aktionsfenster: 15 s. Die letzte gültige Aktion vor Lock zählt; ohne Aktion wird `BASIC_ATTACK` verwendet.
- Auflösung: 2–4 s; ein Ergebnis enthält alle HP-, Status-, Reward- und State-Änderungen.
- Wiederholte Requests mit gleicher `requestId` dürfen keine zweite Wirkung auslösen.
- `HP <= 0` setzt den Spieler auf `DOWNED`: keine Aktion, Kampf weiter beobachten.

Unique-Gegner:

- `PT-UE-01`: **Leone del Flaminio**, Profil `CP-UE-D1-02`.
- `PT-UE-02`: **Legionario della Colonna**, Profil `CP-UE-D1-04`; dient zusätzlich für den kontrollierten Todestest.

## Store, Tod und Wiederbelebung

- Store `PT-STORE-01`, bestehendes Template `STORE-D1-01 / Bottega del Borgo`.
- Teststart: 200 Team-Denare.
- Sortiment: Panis Viatoris 15, Aqua Vitae 30, Rauchkugel 45, Balsam der Wiederkehr 120.
- Der Balsam belebt im Kampf zu Beginn der nächsten Runde mit 30 % Max-HP wieder; Kleriker erhalten 50 %.
- Für den sicheren Wipe-Test existiert nur im Testbuild der auditierte Command `GM_FORCE_TEAM_WIPE`. Er wird nach Runde 2 von `PT-UE-02` ausgelöst.
- Team-Wipe-Kosten: 10 Denare je downed Spieler, zusätzlich 10 % der aktuellen Team-Denare und 3 % des aktuellen Ruhms, maximal 100 Ruhm; keine Ausrüstung geht verloren.
- Beim Revive-Punkt `PT-REVIVE-01-CENTER` innerhalb 15 m: volles HP, normale Kampfstatus entfernen, Weltstatus fortsetzen.

## Zufallsspawns: zwingend nur auf Straßen

`PT-SPAWN-AREA-01` ist lediglich die äußere Begrenzung. Es ist **verboten**, einen zufälligen Punkt im Polygon zu wählen.

Der Server sampelt gleichmäßig nach Linienlänge ausschließlich auf `PT-SPAWN-ROADS-01`. Diese MultiLineString-Geometrie enthält freigegebene Abschnitte der Bergweidstrasse, Bergstrasse und Wallikerstrasse. Zulässig sind nur `residential` und `tertiary`; `service`, `footway`, `path` und `track` sind gesperrt. Vor dem Commit gelten zwingend:

```text
pointOnLine(candidate, PT-SPAWN-ROADS-01, toleranceMeters=1)
AND pointInPolygon(candidate, PT-SPAWN-AREA-01)
AND roadClass IN [residential, tertiary]
```

Pool: 60 % `CP-QE-RATTO`, 40 % `CP-QE-CAVALLEGGERO`. Initial ein Gegner, maximal zwei gleichzeitig; neuer Versuch alle 90–150 s, Wiedererscheinen nach Sieg frühestens nach 180 s. Die vollständigen Abstands- und Blockierregeln stehen im Questdoc und GeoJSON.

Der Zufall muss reproduzierbar sein: `seed = hash(playtestRunId, spawnCycle)`; der Debug-Modus zeigt Seed, geprüfte Kandidaten, Ablehnungsgrund und finalen Spawnpunkt.

## Boss `PT-BOSS-01`

Verwende **Il Cannoniere del Gianicolo**, `CP-WB-CANNONIERE`, `npc_cannoniere_gianicolo` und die drei vorhandenen Stance-Assets.

- Lebenszyklus: `SCHEDULED → ANNOUNCED → ASSEMBLING → ACTIVE → RESOLVING → COMPLETED|FAILED`.
- Ankündigungen im Prototyp: 180, 60 und 15 Sekunden vor Start.
- Ein lebender Spieler innerhalb 30 m registriert das Team. Später eintretende Mitglieder handeln ab der nächsten vollständigen Runde.
- Safe-/Wartezone: 50 m.
- Teilnehmerzahl beim Wechsel `ASSEMBLING → ACTIVE` sperren.
- Nur im Prototyp: `bossHP = max(420, round(2160 × lockedParticipantCount / 13))`; danach nicht dynamisch neu skalieren.
- Phase 1, 100–67 %: Zielmarke und Schutzentscheidung.
- Phase 2, 66–34 %: überhitztes Rohr als Schwächefenster.
- Phase 3, 33–0 %: globales **IN DECKUNG!** mit 6-s-Serverfrist. Reagieren mindestens 60 %, verursacht die Salve halben Schaden; jede gültige Reaktion zählt einmal als +60 Mechanikbeitrag.
- Ergebnis und Rangreward werden in einer einzigen, wiederholbar abrufbaren Transaktion finalisiert.

Da im Feld wahrscheinlich nur ein reales Team spielt, ist Rang 1 ohne Simulation trivial. Für die Ranglisten- und Reward-UI dürfen im **GM-Testmodus** drei deterministische Dummy-Teamsegmente zugeschaltet werden. Diese Funktion darf im Production-Build nicht erreichbar sein.

## Minimale technische Schnitte

Benötigte autoritative Aggregate:

- `PlaytestRun`: Seed, Modulzustand, Feature-Flags, Reset/Audit.
- `TeamState`: Mitglieder, GPS-Gültigkeit, HP, Status, Inventar, Denare, Ruhm.
- `QuestInstance`: Schritt, Versuche, Encounter, Reward-Commit.
- `CombatInstance`: Runde, Deadline, Actions, Lock, ResultSnapshot.
- `WorldSpawnController`: aktive Instanzen, Spawnzyklus, Road-Sample, Ablehnungen.
- `BossEvent`: Lifecycle, Teilnehmer-Lock, Phase, globale Antwort, Beitrag, ResultSnapshot.

Jeder mutierende Command benötigt `requestId`, `playerId`, `teamId`, `clientTimestamp` und gegebenenfalls eine GPS-Probe. Nach Reconnect lädt der Client zuerst einen Snapshot und abonniert erst danach Live-Events.

Testbuild-Steuerung:

- Run mit festem Seed starten/zurücksetzen.
- Boss-Timer vorspulen.
- `GM_FORCE_TEAM_WIPE` auslösen.
- Dummy-Bossteams ein-/ausschalten.
- GPS-Genauigkeit, Reconnect und doppelte Requests simulieren.
- Aktuellen State und Ledger exportieren.

## Definition of Done

- Alle 38 Testfälle im Questdoc wurden ausgeführt und mit Beleg protokolliert.
- Alle 27 P0-Fälle bestehen auf zwei realen Mobilgeräten.
- Kein Spawn liegt außerhalb der freigegebenen Straßenlinien oder auf Haus, Wiese, Fußweg beziehungsweise Privatparzelle.
- Quest- und Boss-Reconnect verlieren weder Runde noch Belohnungszustand.
- Kauf, Questreward, Wipe-Verlust, Respawn und Bossreward sind auch bei Retry genau einmal verbucht.
- Für GPS-Fehler, Spawn-Ablehnungen und Serverlocks existieren verständliche UI-Zustände.
- Gemessene GPS-Streuung und problematische Punkte werden nach dem Feldlauf versioniert ins GeoJSON zurückgeführt.

