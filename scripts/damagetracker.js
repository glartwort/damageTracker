const MODULE_ID = "damage-tracker";
const UNIDENTIFIED_ATTACKER = "Unidentified Source";
var isDebug = false;

console.log(MODULE_ID, "|", MODULE_ID, "is loaded.");

Hooks.on("clientSettingChanged", (settingKey, newValue) => {
  if (settingKey === MODULE_ID+".isDebug") {
    console.log(MODULE_ID, "|", `"isDebug" setting changed to: ${newValue}`);

    isDebug = newValue;
  }
});


Hooks.on("createChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(MODULE_ID, "|", "createChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
  
  if (isDebug) console.log(MODULE_ID, "|", "ChatMessagePF2e call detected");

  //Get actual damage being applied
  if (message.flags.pf2e.context?.type === "damage-taken") {
    const isNPCLoggingEnabled =  game.settings.get(MODULE_ID, "enableNPCTracking");
    let attackerId =  message.flags.pf2e.origin?.actor;
    const attackActor = (attackerId)?fromUuidSync(attackerId):null;
    const attacker =    (attackActor)?attackActor.name:UNIDENTIFIED_ATTACKER;
    let isNPC =       (attackActor?.type !== "character");

    if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
      isNPC =       false;      // since it might be from a PC, we need to treat it as such
      attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
    }

    const damageRegex = /span>\stakes\s(\d+)\sdamage./;
    const damageString = message.content;
    const validUpdate = message.flags.pf2e.appliedDamage?.updates;  //if missing, 0 damage done - process to get damageRoll anyway
    const damage =      (validUpdate)?validUpdate[0].value:0;
    const victim =      fromUuidSync(message.flags.pf2e.appliedDamage?.uuid)?.name;
        
    if ((!isNPC) || (isNPCLoggingEnabled)) {
      let damageRoll = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (dmgMatch) {
            damageRoll = parseInt(dmgMatch[1],10);
      }
      
      if (isDebug) {
        console.log(MODULE_ID, "|", "Damage Taken!");
        console.log(MODULE_ID, "|", "damage Amount: \t", damageRoll);
        console.log(MODULE_ID, "|", "damage: \t", damage);
        console.log(MODULE_ID, "|", "attacker: \t", attacker);
        console.log(MODULE_ID, "|", "attacker is NPC?:", isNPC)
        console.log(MODULE_ID, "|", "victim: \t", victim);
        console.log(MODULE_ID, "|", "track NPCs?", isNPCLoggingEnabled);
      }

      AddOrMergeActor(attackerId, attacker, isNPC, damageRoll, damage);
    }
  }

  //Stash damage rolls for later reference (when damage is applied)
  if (message.flags.pf2e.context?.type === "damage-roll") {
    const isNPCLoggingEnabled =  game.settings.get(MODULE_ID, "enableNPCTracking");
    let attackerId =  message.flags.pf2e.origin?.actor;
    const attackActor = (attackerId)?fromUuidSync(attackerId):null;
    const attacker =    (attackActor)?attackActor.name:UNIDENTIFIED_ATTACKER;
    let isNPC =       (attackActor?.type !== "character");

    if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
      isNPC =       false;      // since it might be from a PC, we need to treat it as such
      attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
    }

    if ((!isNPC) || (isNPCLoggingEnabled)) {
      let damageRoll = 0;
      message.rolls.forEach(r => {
        damageRoll = Math.max(damageRoll,r.total);
      });
            
      if (isDebug) {
        console.log(MODULE_ID, "|", "Damage Taken!");
        console.log(MODULE_ID, "|", "damage Amount: \t", damageRoll);
        console.log(MODULE_ID, "|", "attacker: \t", attacker);
        console.log(MODULE_ID, "|", "attacker is NPC?:", isNPC)
        console.log(MODULE_ID, "|", "track NPCs?", isNPCLoggingEnabled);
      }

      StashDamageRoll(attackerId, attacker, isNPC, damageRoll);
    }
  }
});

//Listen for damage "reverts" and clear that data
Hooks.on("updateChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(MODULE_ID, "|", "UpdateChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
    
  if (isDebug) console.log(MODULE_ID, "|", "ChatMessagePF2e call detected");

  if (message.flags.pf2e.context?.type === "damage-taken") {
      
    if (!message.flags.pf2e.appliedDamage.updates) return;    

    if (data.flags.pf2e.appliedDamage.isReverted)
    {
      if (isDebug) console.log(MODULE_ID, "|", "Revert damage found");

      let attackerId =  message.flags.pf2e.origin?.actor;
      const attackActor = (attackerId)?fromUuidSync(attackerId):null;
      let isNPC =       (attackActor?.type !== "character");

      if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
        isNPC =       false;                  //since it might be from a PC, we need to treat it as such
        attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
      }

      const damageRegex = /span>\stakes\s(\d+)\sdamage./;
      const damageString = data.content;
      const damage =      message.flags.pf2e.appliedDamage.updates[0].value;
        
              
      let damageRoll = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (!dmgMatch) 
         return;
        
      damageRoll = parseInt(dmgMatch[1],10);
        
      if (isDebug) {
        console.log(MODULE_ID, "|", "Damage Reverted!");
        console.log(MODULE_ID, "|", "damage: \t", damage);
      }

      RevertDamage(attackerId, damageRoll, damage);
    }
  }
});

async function StashDamageRoll(key, name, isNPC, damageRoll) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
  
  if (!actorMap[key]) {   //create new actor in damageRolls
    actorMap[key] = {};
    actorMap[key].name = name;
    actorMap[key].isNPC = isNPC;
    actorMap[key].maxDmgRoll = damageRoll;
    actorMap[key].prevMaxDmgRoll = 0;

    if (isDebug) console.log(MODULE_ID, "|", "Created new", (isNPC)?"NPC":"PC", "for:", name, "with", damageRoll, "damage.");
  }
  else {
    const existing = actorMap[key];
    checkAndUpdateMaxDmgRoll(existing,damageRoll);
   
    if (isDebug) console.log(MODULE_ID, "|", "Merged data into existing", (isNPC)?"NPC":"PC", "for:", existing.name, "with", damageRoll, "damage.");
  }

  await game.settings.set(MODULE_ID, "damageMap", actorMap);
}

function checkAndUpdateMaxDmgRoll(actor,damageRoll) {
  let currentMax = (actor.maxDmgRoll)?actor.maxDmgRoll:0;
  
  if (damageRoll > currentMax) {
    actor.prevMaxDmgRoll = currentMax;
    actor.maxDmgRoll = damageRoll;
  } else {
    // if the roll isn't bigger than the current max, but previous max is zero, update previous max.
    // This will mostly likely occur due to a revert (that set previous max to 0).
    if (actor.prevMaxDmgRoll==0) {
      actor.prevMaxDmgRoll = damageRoll;
    }
  }
}

function checkAndUpdateMaxDmg(actor,damage) {
  let currentMax = (actor.maxDmg)?actor.maxDmg:0;
  if (damage > currentMax) {
    actor.prevMaxDmg = currentMax;
    actor.maxDmg = damage;
   } else {
    // if the damage isn't bigger than the current max, but previous max is zero, update previous max.
    // This will mostly likely occur due to a revert (that set previous max to 0).
    if (actor.prevMaxDmg==0) {
      actor.prevMaxDmg = damage;
    }
  }
}
      
async function AddOrMergeActor(key, name, isNPC, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {   //create new actor in damageMap
    actorMap[key] = {};
    actorMap[key].name = name;
    actorMap[key].isNPC = isNPC;
    actorMap[key].maxDmgRoll = damageRoll;
    actorMap[key].prevMaxDmgRoll = 0;
    actorMap[key].maxDmg = damage;
    actorMap[key].prevMaxDmg = 0;
    actorMap[key].totDmg = damage;

    const Actortype = (isNPC)?"NPC":"PC";
    
    if (isDebug) console.log(MODULE_ID, "|", "Created new", (isNPC)?"NPC":"PC", "for:", name, "with", damage, "damage.");
  } 
  else {    //actor already exists, update
    const actor = actorMap[key];
    const Actortype = (actor.isNPC)?"NPC":"PC";
    
    let absMaxDmg = Math.max(damageRoll,damage);  //if damage is > damageRoll, use that.. 

    checkAndUpdateMaxDmgRoll(actor,absMaxDmg);
        
    //existing maxDmg and totDmg could be NaN - it's not added by StashDamageRoll
    checkAndUpdateMaxDmg(actor,damage);

    actor.totDmg = (actor.totDmg)?actor.totDmg + damage:damage;
    
    if (isDebug) console.log(MODULE_ID, "|", "Merged data into existing", (isNPC)?"NPC":"PC", "for:", actor.name, "with", damage, "damage.");
  }
  await game.settings.set(MODULE_ID, "damageMap", actorMap);
}

async function RevertDamage(key, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {  
    if (isDebug) console.log(MODULE_ID, "|", "Actor is not in the table to revert damage from");
  } 
  else {    //actor already exists, update
    const actor = actorMap[key];
    const Actortype = (actor.isNPC)?"NPC":"PC";
    
    if (actor.maxDmgRoll == damageRoll) {
      actor.maxDmgRoll = actor.prevMaxDmgRoll;
      actor.prevMaxDmgRoll = 0;     //don't save the current or it could never revert that roll.  Shouldn't happen, but just in case.

    }    
    
    if (actor.maxDmg == damage) {
      actor.maxDmg = actor.prevMaxDmg;
      actor.prevMaxDmg = 0;     //don't save the current or it could never revert that roll.  Shouldn't happen, but just in case.
    }

    actor.totDmg += -damage;

    if (isDebug) console.log(MODULE_ID, "|", "Reverted damage from existing", (actor.isNPC)?"NPC":"PC", "for:", actor.name, "with", damage, "damage.");
  
    await game.settings.set(MODULE_ID, "damageMap", actorMap);
  }
  
}
