
import React from 'react';
import { FESTIVAL_PROGRAMS } from '../constants';

const ProgramGuide: React.FC = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
      {FESTIVAL_PROGRAMS.map((prog) => (
        <div 
          key={prog.id} 
          className="glass p-4 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group hover:-translate-y-1 duration-300"
        >
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{prog.icon}</div>
          <h3 className="font-bold text-sm text-slate-100">{prog.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{prog.description}</p>
          <div className="mt-3 text-[10px] uppercase tracking-wider text-orange-500 font-semibold">
            {prog.category}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProgramGuide;
