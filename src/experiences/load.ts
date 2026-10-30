const experience = document.querySelector<HTMLElement>('[data-experience]');
if (experience) {
  const load = async () => {
    switch (experience.dataset.experience) {
      case 'cad-flow': return (await import('./cad/client')).mount(experience);
      case 'output-forecast': return (await import('./energy/client')).mount(experience);
      case 'wiring-query': return (await import('./wiring/client')).mount(experience);
    }
  };
  load().catch(() => {
    const message = document.querySelector<HTMLElement>('[data-experience-error]');
    if (message) message.hidden = false;
  });
}
