import React from "react";

export const ProductImageFallback = ({ 
  id, 
  size = "normal" 
}: { 
  id: string; 
  size?: "normal" | "sm" | "xs" 
}) => {
  if (size === "xs") {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-1 relative select-none rounded-lg">
        <div className="w-[70%] h-[70%] rotate-45 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xs shadow-xs flex items-center justify-center border border-white/20">
          <div className="-rotate-45 text-[9px] font-extrabold text-white font-mono leading-none">
            {id}
          </div>
        </div>
      </div>
    );
  }

  if (size === "sm") {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-2 relative select-none rounded-xl">
        <div className="w-[65%] h-[65%] rotate-45 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-md shadow-xs flex items-center justify-center border border-white/20">
          <div className="-rotate-45 text-center px-0.5">
            <span className="block text-[7px] text-emerald-100 font-bold tracking-wider font-mono leading-none">COD</span>
            <span className="block text-[11px] font-black text-white font-mono tracking-tight leading-none mt-0.5">{id}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 relative select-none">
      <div className="w-[60%] h-[60%] min-w-16 min-h-16 max-w-[130px] max-h-[130px] rotate-45 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl shadow-md flex items-center justify-center border-2 border-white/20">
        <div className="-rotate-45 text-center px-1">
          <span className="block text-[9px] sm:text-[10px] text-emerald-100 font-bold tracking-widest font-mono uppercase leading-tight">CODIGO</span>
          <span className="block text-xs sm:text-base font-black text-white font-mono tracking-tight leading-normal">{id}</span>
        </div>
      </div>
    </div>
  );
};
