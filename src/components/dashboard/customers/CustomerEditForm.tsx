'use client'

/**
 * CustomerEditForm - Formulario Avanzado de Edición de Clientes
 * 
 * Características:
 * - Formulario multi-paso con validación en tiempo real
 * - Modo oscuro optimizado
 * - Campos avanzados (tags, segmentación, crédito)
 * - Vista previa de cambios
 * - Autoguardado opcional
 * - Historial de cambios
 * - Validación inteligente
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  User, Phone, Mail, MapPin, FileText, AlertCircle, Check, 
  CreditCard, Building
} from 'lucide-react'