const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

//new v2 version
class DamageTrackerSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: 'form',
    position: {width: 500, height: 'auto'},
    window: {title: "Damage Tracker Details", resizable: true},
    form: {
      handler: DamageTrackerSettings.onSubmitForm,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    topButtons: {template: `modules/${MODULE_ID}/templates/partials/topButtons.hbs`},
    content: {template: `modules/${MODULE_ID}/templates/partials/tableContent.hbs`},
    exportButton: {template: `modules/${MODULE_ID}/templates/partials/exportButton.hbs`},
  }

  get document() {
    return this.options.document;
  }

  get title() {
    return this.options.window.title;
  }

  async _onRender(context,options) {
    const html = this.element;

    if(!this._listenersBound) {
      html.querySelector(".clear-tracking-button")?.addEventListener("click", this.#onClearTrackingClick.bind(this));
      html.querySelector(".clear-NPCs-button")?.addEventListener("click", this.#onClearNPCsClick.bind(this));
      html.querySelector(".export-damage-map")?.addEventListener("click", this.#onExportDamapgeMapClick.bind(this));
    
      // Start refresh loop - only set when listeners are initially bound 
      // i.e. don't check this every render
      if (!this._pollInterval) {
        this._pollInterval = setInterval(() => {
          if (this.rendered) this.refreshContent();
        }, 3000); // 3 seconds
      }
    }
  }

  _getSortedActorData() {
    const dmgMap = game.settings.get(MODULE_ID, "damageMap");
    return Object.values(dmgMap).sort((a, b) => b.totDmg - a.totDmg);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sortedActors = this._getSortedActorData();

    if (isDebug) {
      console.log(LOG_PREFIX, "DamageTracker Actor list: ");
      console.log(LOG_PREFIX, sortedActors);
    }

    return {
      formData: {
        actors: sortedActors
      }
    };  
  }

  static async onSubmitForm(event, form, formData) {
    const settings = foundry.utils.expandObject(formData.object);
    await Promise.all(
        Object.entries(settings)
            .map(([key, value]) => game.settings.set(MODULE_ID, key, value))
    );

  //  await this.document.update(formData.object);
  
}
  
  
  //Click Handlers
   //TODO: Should I add buttons for each "heading" to allow for Sorting by listening to each button and refreshing?
  async #onClearTrackingClick(event) {
    event.preventDefault();
    
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {title: "Clear Tracking Data?"},
      content: "Are you sure you want to proceed?",
      rejectClose: false,
      modal: true
    });

    if (proceed) {
      await game.settings.set(MODULE_ID, "damageMap", {});
      ui.notifications.info("Damage tracking data has been cleared.");

      //refresh Settings page since data changed.
      this.render(true);
    }
  }

  async #onClearNPCsClick(event) {
    event.preventDefault();
        
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {title: "Clear NPC Data?"},
      content: "Are you sure you want to proceed?",
      rejectClose: false,
      modal: true
    });
   
    if (proceed) {
      const dmgMap = game.settings.get(MODULE_ID,"damageMap");
      
      //filter to only PCs and set damage map to new filtered set.
      const filteredActors = Object.values(dmgMap).filter((a) => !a.isNPC);

      const newDmgMap = {};

      filteredActors.forEach(actor => {
        newDmgMap[actor.key] = {
          name: actor.name,
          isNPC: actor.isNPC,
          maxDmgRoll: actor.maxDmgRoll,
          maxDmg: actor.maxDmg,
          totDmg: actor.totDmg
        }
      });
      
      await game.settings.set(MODULE_ID, "damageMap", newDmgMap);
      ui.notifications.info("Damage tracking data for NPCs has been cleared.");

      //refresh Settings page since data changed.
      this.render(true);
    }  
  }
  
 #onExportDamapgeMapClick(event) {
    var exportData = "Actor Name, isNPC, Max Damage Roll, Max Damage, Total Damage\n";
    const dmgMap = game.settings.get(MODULE_ID,"damageMap");
    const sortedActors = Object.values(dmgMap).sort((a,b) => b.totDmg - a.totDmg);

    sortedActors.forEach(actor => {
      exportData += `${actor.name}, ${actor.isNPC}, ${actor.maxDmgRoll}, ${actor.maxDmg}, ${actor.totDmg}\n`;
    });

    const expDialog = new foundry.applications.api.DialogV2({
      window: {
        title: "Export Damage Data (CSV)"
      },
      position: {width: 500, height: 'auto' },
      content: `<textarea readonly style="width:100%; height:300px;">${exportData}</textarea>`,
      buttons: [
        {
          action: "close",
          label: "Close",
          callback: () => ui.notifications.info("Dialog closed.")
        }
      ],
      rejectClose: true,
      modal:false
    });
    
    expDialog.render(true);
  }

  async refreshContent() {
    const container = this.element?.querySelector(".damageTable");  //top element of tableContent.hbs
    if (!container) return;

    // Prepare fresh data
    const formData = {
      actors: this._getSortedActorData() 
    };

    // Render the partial template
    const newHTML = await renderTemplate(DamageTrackerSettings.PARTS.content.template, { formData });

    // Replace the content
     container.innerHTML = newHTML;
  }

  close() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
    }
    super.close();
    if (isDebug) console.log(MODULE_ID, "| removed refresh timer, closed activelisteners");
  }
}
