const MODULE_ID = "DamageTracker";

console.log(MODULE_ID, "is loaded.");

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  console.log("!! preCreateChatMessage call detected !!");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
  
  console.log("!! ChatMessagePF2e call detected !!");

  if (data.flags.pf2e.context.type === "damage-taken") {
    if (!message.flags.pf2e.appliedDamage.updates) return;

    
    const attackerId =  data.flags.pf2e.origin.actor;
    const attackActor = fromUuidSync(attackerId);
    const damageRegex = /span>\stakes\s(\d+)\sdamage./;
    const damageString = data.content;
    const damage =      message.flags.pf2e.appliedDamage.updates[0].value;
    const attacker =    attackActor.name;
    const isNPC =       (attackActor.type !== "character") //(damage%2);   //BS shorthand
    const victim =      fromUuidSync(data.flags.pf2e.appliedDamage.uuid).name;
    const npcTrackEnabled = game.settings.get(MODULE_ID, "enableNPCTracking");
    const clearTracking = game.settings.get(MODULE_ID, "clearTracking");
    
    let damageAmt = 0;
    const dmgMatch = damageString.match(damageRegex);

    if (dmgMatch) {
         damageAmt = parseInt(dmgMatch[1],10);
    }
    
    console.log("!! Damage Taken !!");
    console.log("damage Amount: \t", damageAmt);
    console.log("damage: \t", damage);
    console.log("attacker: \t", attacker);
    console.log("attacker is NPC?:", isNPC)
    console.log("victim: \t", victim);
    console.log("track NPCs?", npcTrackEnabled);
    console.log("clear Tracking data?", clearTracking);

    //figure out if attacker is an NPC and update next line:
    AddOrMergeActor(attackerId, attacker, isNPC, damageAmt, damage);
  }
 });

 async function AddOrMergeActor(key, name, isNPC, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {   //create new actor in damageMap
    actorMap[key] = {};
    actorMap[key].name = name;
    actorMap[key].isNPC = isNPC;
    actorMap[key].maxDmgRoll = damageRoll;
    actorMap[key].maxDmg = damage;
    actorMap[key].totDmg = damage;

    const Actortype = (isNPC)?"NPC":"PC";

    console.log(`Created new ${{Actortype}} for: ${name} with ${damage}`);
  } 
  else {    //actor already exists, update
    const existing = actorMap[key];
    
    actorMap[key].maxDmgRoll = Math.max(existing.maxDmgRoll, damageRoll);
    actorMap[key].maxDmg = Math.max(existing.maxDmg, damage);
    actorMap[key].totDmg = existing.totDmg + damage;
  }
  await game.settings.set(MODULE_ID, "damageMap", actorMap);
}
