const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
          Start Building.
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          A clean, dark canvas ready for your next idea.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <button className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-80">
            Get Started
          </button>
          <button className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
