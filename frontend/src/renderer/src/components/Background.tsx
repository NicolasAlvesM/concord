function Background(): React.JSX.Element {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050508]">
      {/* Subtle glowing ambient blobs that shine softly through dark Onyx glass panels */}
      <div className="animate-blob absolute -top-32 -left-32 h-144 w-xl rounded-full bg-[#5b21b6]/35 blur-[120px]" />
      <div className="animate-blob-slow absolute top-1/3 -right-40 h-120 w-120 rounded-full bg-[#4338ca]/30 blur-[120px]" />
      <div className="animate-blob-fast absolute -bottom-40 left-1/3 h-152 w-152 rounded-full bg-[#0e7490]/25 blur-[120px]" />
      <div className="animate-blob absolute top-1/2 left-2/3 h-112 w-md rounded-full bg-[#9d174d]/20 blur-[110px]" />
      {/* Dark vignette gradient to preserve high contrast Onyx feel around edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(3,4,6,0.85)_100%)]" />
    </div>
  )
}

export default Background
