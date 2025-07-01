
export class ListenerGroupRegistry {

  registries: any[] = [];

  reportRegisteredListeners = (eventName: any) => {
    // console.log('ListenerGroupRegistry: Registered listeners:', eventName);
    for (let i = 0; i < this.registries.length; i++) {
      const registry = this.registries[i];
      // console.log('ListenerGroupRegistry:  * ', registry.registryName, ' (count = ', registry.getListenerCount(), ' of max ', registry.getMaxListenerCount(), ')');
      for (let listenerId in registry.listenerIdsToListeners) {
        const listener = registry.listenerIdsToListeners[listenerId];
        // console.log('ListenerGroupRegistry:     - ', listener.listenerUuid);
      }
    }
  };

  addRegistry = (registry: any) => {
    this.registries.push(registry);
  };

}

export default new ListenerGroupRegistry();
