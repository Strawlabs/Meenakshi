import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors, ThemeColors, LightTypography, DarkTypography, ThemeTypography } from '../constants/theme';

interface ThemeContextData {
  colors: ThemeColors;
  typography: ThemeTypography;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextData>({
  colors: LightColors,
  typography: LightTypography,
  isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;
  const typography = isDark ? DarkTypography : LightTypography;

  return (
    <ThemeContext.Provider value={{ colors, typography, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
