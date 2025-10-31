import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import pandas as pd
import os
import json
import shutil
from datetime import datetime
from pathlib import Path
import re
# Nota: Se pueden agregar imágenes con PIL si es necesario, pero por ahora usamos emojis/unicode
#inicio
#fecha_frame
#El mismo para gestión CALL checkbox_v2_ivr
#EJECUTAR
class EvidenciasApp:
    def __init__(self, root):
        self.root = root
        self.root.title("📋 EVIDENCIAS - Sistema de Gestión de Documentación")
        
        # Centrar ventana y hacer que se adapte automáticamente
        self.root.configure(bg="#f5f5f5")
        self.root.update_idletasks()  # Actualizar para obtener dimensiones reales
        
        # Obtener dimensiones de pantalla
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        # Tamaño base adaptativo (80% de pantalla máximo)
        window_width = min(1400, int(screen_width * 0.85))
        window_height = min(900, int(screen_height * 0.85))
        
        # Centrar ventana
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.root.minsize(1000, 700)  # Tamaño mínimo
        
        # Variables
        self.datos_fuente_path = None
        self.nuevos_datos_path = None
        self.datos_fuente_df = None
        self.nuevos_datos_df = None
        self.total_clientes = 0
        
        # Archivos de sección Gestiones
        self.ivr_base_excel = None
        self.ivr_base_audio = None
        self.ivr_use_for_call = tk.BooleanVar(value=False)
        self.ivr_match_cliente = "CUENTA"
        self.ivr_match_archivo = "CUENTA"
        
        self.sms_base_excel = None
        self.sms_match_cliente = "CUENTA"
        self.sms_match_archivo = "NUMERO DE CREDITO"
        
        self.call_gestiones_excel = None
        self.call_consolidado_excel = None
        self.call_audios_fisicos_path = None
        self.v2_enabled = tk.BooleanVar(value=False)
        
        self.carpeta_salida_path = None
        self.nombre_carpeta_salida = ""
        self.auditor_window_open = False
        
        # Diccionario para almacenar archivos no creados (para logs finales)
        self.archivos_no_creados = {
            "ivr_sin_match": [],
            "sms_sin_match": [],
            "call_sin_match": [],
            "ivr_sin_audio": [],
            "call_sin_audio": [],
            "carpetas_vacias": []
        }
        
        self.setup_ui()
        
    def setup_ui(self):
        # Título principal con imagen decorativa
        title_frame = tk.Frame(self.root, bg="#2c3e50", relief=tk.RAISED, bd=2)
        title_frame.pack(fill=tk.X, padx=10, pady=(10, 5))
        
        # Frame interno para título con icono
        title_inner = tk.Frame(title_frame, bg="#2c3e50")
        title_inner.pack(pady=15)
        
        # Icono decorativo (emoji grande)
        icon_label = tk.Label(
            title_inner,
            text="📄",
            font=("Arial", 32),
            bg="#2c3e50",
            fg="white"
        )
        icon_label.pack(side=tk.LEFT, padx=(0, 15))
        
        title_label = tk.Label(
            title_inner,
            text="EVIDENCIAS",
            font=("Arial", 28, "bold"),
            bg="#2c3e50",
            fg="white"
        )
        title_label.pack(side=tk.LEFT)
        
        subtitle_label = tk.Label(
            title_frame,
            text="Sistema de Gestión de Documentación y Procesos",
            font=("Arial", 11),
            bg="#2c3e50",
            fg="#ecf0f1"
        )
        subtitle_label.pack(pady=(0, 10))
        
        # Notebook para paginación (pestañas)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # Pestaña 1: SECCIÓN BASE
        tab_base = tk.Frame(self.notebook, bg="#f5f5f5")
        self.notebook.add(tab_base, text="📊 BASE")
        
        # Canvas para scroll en pestaña BASE
        canvas_base = tk.Canvas(tab_base, bg="#f5f5f5", highlightthickness=0)
        scrollbar_base = ttk.Scrollbar(tab_base, orient="vertical", command=canvas_base.yview)
        scrollable_base = tk.Frame(canvas_base, bg="#f5f5f5")
        
        scrollable_base.bind("<Configure>", lambda e: canvas_base.configure(scrollregion=canvas_base.bbox("all")))
        canvas_base.create_window((0, 0), window=scrollable_base, anchor="nw")
        canvas_base.configure(yscrollcommand=scrollbar_base.set)
        
        canvas_base.pack(side="left", fill="both", expand=True)
        scrollbar_base.pack(side="right", fill="y")
        
        # SECCIÓN BASE con icono decorativo
        base_section = self.create_section(scrollable_base, "📊 SECCIÓN BASE")
        
        # Frame decorativo con ícono
        decor_frame = tk.Frame(base_section, bg="#ecf0f1", pady=5)
        decor_frame.pack(fill=tk.X)
        icon_decor = tk.Label(
            decor_frame,
            text="📁",
            font=("Arial", 24),
            bg="#ecf0f1"
        )
        icon_decor.pack(side=tk.LEFT, padx=(0, 10))
        desc_decor = tk.Label(
            decor_frame,
            text="Cargue los archivos fuente con la información de clientes y gestiones",
            font=("Arial", 9),
            bg="#ecf0f1",
            fg="#7f8c8d"
        )
        desc_decor.pack(side=tk.LEFT)
        
        # Nombre cliente + cuenta
        cliente_frame = tk.Frame(base_section, bg="#ecf0f1", pady=10, padx=10)
        cliente_frame.pack(fill=tk.X, pady=5)
        
        tk.Label(
            cliente_frame,
            text="Clientes:",
            font=("Arial", 11, "bold"),
            bg="#ecf0f1"
        ).pack(side=tk.LEFT, padx=5)
        
        self.clientes_entry = tk.Entry(cliente_frame, width=15, font=("Arial", 11))
        self.clientes_entry.pack(side=tk.LEFT, padx=5)
        self.clientes_entry.insert(0, "0")
        self.clientes_entry.config(state="readonly")
        
        tk.Label(
            cliente_frame,
            text="carpetas a crear",
            font=("Arial", 11),
            bg="#ecf0f1"
        ).pack(side=tk.LEFT, padx=5)
        
        # Datos fuente
        self.datos_fuente_frame = self.create_file_selector(
            base_section,
            "Datos fuente:",
            "datos_fuente.xlsx",
            self.select_datos_fuente,
            self.datos_fuente_path
        )
        
        # Nuevos datos
        self.nuevos_datos_frame = self.create_file_selector(
            base_section,
            "Nuevos Datos:",
            "nuevos_datos.xlsx",
            self.select_nuevos_datos,
            self.nuevos_datos_path
        )
        self.nuevos_datos_frame.state = "disabled"
        
        # Fechas
        # fecha_frame = tk.Frame(base_section, bg="#ecf0f1", pady=10, padx=10)
        # fecha_frame.pack(fill=tk.X, pady=5)
        
        # tk.Label(fecha_frame, text="Fecha inicio:", font=("Arial", 10), bg="#ecf0f1").pack(side=tk.LEFT, padx=5)
        # self.fecha_inicio = tk.Entry(fecha_frame, width=12)
        # self.fecha_inicio.insert(0, "20/10/2025")
        # self.fecha_inicio.pack(side=tk.LEFT, padx=5)
        
        # tk.Label(fecha_frame, text="Fecha Fin:", font=("Arial", 10), bg="#ecf0f1").pack(side=tk.LEFT, padx=5)
        # self.fecha_fin = tk.Entry(fecha_frame, width=12)
        # self.fecha_fin.insert(0, "24/10/2025")
        # self.fecha_fin.pack(side=tk.LEFT, padx=5)
        
        self.probar_coincidencia_btn = tk.Button(
            base_section,
            text="🔍 Probar Coincidencia",
            command=self.probar_coincidencia,
            bg="#3498db",
            fg="white",
            font=("Arial", 10, "bold"),
            state="disabled",
            cursor="hand2",
            pady=5
        )
        self.probar_coincidencia_btn.pack(pady=10)
        
        # Configurar scroll para BASE
        canvas_base.bind_all("<MouseWheel>", lambda e: canvas_base.yview_scroll(int(-1*(e.delta/120)), "units") if self.notebook.index(self.notebook.select()) == 0 else None)
        
        # Pestaña 2: SECCIÓN GESTIONES
        tab_gestiones = tk.Frame(self.notebook, bg="#f5f5f5")
        self.notebook.add(tab_gestiones, text="⚙️ GESTIONES")
        
        # Canvas para scroll en pestaña GESTIONES
        canvas_gestiones = tk.Canvas(tab_gestiones, bg="#f5f5f5", highlightthickness=0)
        scrollbar_gestiones = ttk.Scrollbar(tab_gestiones, orient="vertical", command=canvas_gestiones.yview)
        scrollable_gestiones = tk.Frame(canvas_gestiones, bg="#f5f5f5")
        
        scrollable_gestiones.bind("<Configure>", lambda e: canvas_gestiones.configure(scrollregion=canvas_gestiones.bbox("all")))
        canvas_gestiones.create_window((0, 0), window=scrollable_gestiones, anchor="nw")
        canvas_gestiones.configure(yscrollcommand=scrollbar_gestiones.set)
        
        canvas_gestiones.pack(side="left", fill="both", expand=True)
        scrollbar_gestiones.pack(side="right", fill="y")
        
        # SECCIÓN GESTIONES con icono decorativo
        gestiones_section = self.create_section(scrollable_gestiones, "⚙️ SECCIÓN GESTIONES")
        
        # Frame decorativo
        decor_gestiones = tk.Frame(gestiones_section, bg="#ecf0f1", pady=5)
        decor_gestiones.pack(fill=tk.X)
        icon_gestiones = tk.Label(
            decor_gestiones,
            text="⚡",
            font=("Arial", 24),
            bg="#ecf0f1"
        )
        icon_gestiones.pack(side=tk.LEFT, padx=(0, 10))
        desc_gestiones = tk.Label(
            decor_gestiones,
            text="Configure las gestiones IVR, SMS y CALL con sus archivos y configuraciones correspondientes",
            font=("Arial", 9),
            bg="#ecf0f1",
            fg="#7f8c8d"
        )
        desc_gestiones.pack(side=tk.LEFT)
        
        # IVR
        ivr_frame = self.create_gestion_frame(
            gestiones_section,
            "📞 IVR",
            "[nombre de cliente]ivr.xlsx",
            "ivr[nombre del cliente].mp3"
        )
        
        self.ivr_base_excel_frame = self.create_file_selector(
            ivr_frame,
            "archivo base:",
            "archivo base.xlsx",
            self.select_ivr_base_excel,
            self.ivr_base_excel
        )
        
        self.ivr_base_audio_frame = self.create_file_selector(
            ivr_frame,
            "audio base:",
            "audio base.mp3",
            self.select_ivr_base_audio,
            self.ivr_base_audio,
            filetypes=[("MP3 files", "*.mp3")]
        )
        
        # Checkbox usar mismo archivo para CALL
        # checkbox_frame = tk.Frame(ivr_frame, bg="#ecf0f1")
        # checkbox_frame.pack(fill=tk.X, pady=5)
        # checkbox_v2_ivr = tk.Checkbutton(
        #     checkbox_frame,
        #     text="✅ El mismo para gestión CALL",
        #     variable=self.ivr_use_for_call,
        #     bg="#ecf0f1",
        #     font=("Arial", 9),
        #     cursor="hand2",
        #     command=self.toggle_call_gestiones_selector
        # )
        #checkbox_v2_ivr.pack(side=tk.LEFT)
        
        # Match IVR
        match_frame = tk.Frame(ivr_frame, bg="#ecf0f1", pady=5)
        match_frame.pack(fill=tk.X)
        
        tk.Label(match_frame, text="CLIENTE:", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.ivr_match_cliente_combo = ttk.Combobox(match_frame, width=15, values=["CUENTA", "TELEFONO", "DNI"])
        self.ivr_match_cliente_combo.pack(side=tk.LEFT, padx=5)
        self.ivr_match_cliente_combo.set("CUENTA")
        
        tk.Label(match_frame, text="match", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        self.ivr_match_archivo_combo = ttk.Combobox(match_frame, width=15, values=["CUENTA", "TELEFONO", "DNI"])
        self.ivr_match_archivo_combo.pack(side=tk.LEFT, padx=5)
        self.ivr_match_archivo_combo.set("CUENTA")
        
        tk.Label(match_frame, text="archivo base", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        # SMS
        sms_frame = self.create_gestion_frame(
            gestiones_section,
            "💬 SMS",
            "SMS_[nombre de cliente].xlsx"
        )
        
        self.sms_base_excel_frame = self.create_file_selector(
            sms_frame,
            "archivo base:",
            "sms.xlsx",
            self.select_sms_base_excel,
            self.sms_base_excel
        )
        
        # Match SMS
        match_sms_frame = tk.Frame(sms_frame, bg="#ecf0f1", pady=5)
        match_sms_frame.pack(fill=tk.X)
        
        tk.Label(match_sms_frame, text="CLIENTE:", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.sms_match_cliente_combo = ttk.Combobox(match_sms_frame, width=15, values=["CUENTA", "TELEFONO", "DNI"])
        self.sms_match_cliente_combo.pack(side=tk.LEFT, padx=5)
        self.sms_match_cliente_combo.set("CUENTA")
        
        tk.Label(match_sms_frame, text="match", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        self.sms_match_archivo_combo = ttk.Combobox(match_sms_frame, width=15, values=["NUMERO DE CREDITO", "CUENTA", "TELEFONO"])
        self.sms_match_archivo_combo.pack(side=tk.LEFT, padx=5)
        self.sms_match_archivo_combo.set("NUMERO DE CREDITO")
        
        tk.Label(match_sms_frame, text="archivo base", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        # CALL
        call_frame = self.create_gestion_frame(
            gestiones_section,
            "📞 CALL",
            "[nombre de cliente]_gestiones.xlsx",
            "[nombre de cliente]_[cuenta del cliente].mp3"
        )
        
        self.call_gestiones_frame = self.create_file_selector(
            call_frame,
            "archivo gestiones:",
            "nuevos_datos.xlsx",
            self.select_call_gestiones_excel,
            self.call_gestiones_excel
        )
        
        self.call_consolidado_frame = self.create_file_selector(
            call_frame,
            "archivo call:",
            "reporte_consolidado.xlsx",
            self.select_call_consolidado_excel,
            self.call_consolidado_excel
        )
        
        # Botón para limpiar selección de call consolidado
        btn_limpiar_call = tk.Button(
            call_frame,
            text="🗑️ Limpiar",
            command=self.limpiar_call_consolidado,
            bg="#e74c3c",
            fg="white",
            font=("Arial", 8),
            cursor="hand2",
            padx=5
        )
        btn_limpiar_call.pack(side=tk.LEFT, padx=5)
        
        # Audios físicos
        self.call_audios_fisicos_frame = self.create_file_selector(
            call_frame,
            "✅ audios físicos:",
            "carpetas",
            self.select_call_audios_fisicos,
            self.call_audios_fisicos_path,
            is_directory=True
        )
        
        
        # Configurar scroll para GESTIONES
        canvas_gestiones.bind_all("<MouseWheel>", lambda e: canvas_gestiones.yview_scroll(int(-1*(e.delta/120)), "units") if self.notebook.index(self.notebook.select()) == 1 else None)
        
        # Pestaña 3: CONFIGURACIÓN V2
        tab_v2 = tk.Frame(self.notebook, bg="#f5f5f5")
        self.notebook.add(tab_v2, text="⚙️ V2")
        
        # Canvas para scroll en pestaña V2
        canvas_v2 = tk.Canvas(tab_v2, bg="#f5f5f5", highlightthickness=0)
        scrollbar_v2 = ttk.Scrollbar(tab_v2, orient="vertical", command=canvas_v2.yview)
        scrollable_v2 = tk.Frame(canvas_v2, bg="#f5f5f5")
        
        scrollable_v2.bind("<Configure>", lambda e: canvas_v2.configure(scrollregion=canvas_v2.bbox("all")))
        canvas_v2.create_window((0, 0), window=scrollable_v2, anchor="nw")
        canvas_v2.configure(yscrollcommand=scrollbar_v2.set)
        
        canvas_v2.pack(side="left", fill="both", expand=True)
        scrollbar_v2.pack(side="right", fill="y")
        
        # Checkbox V2 con decoración
        v2_section = tk.Frame(scrollable_v2, bg="#ecf0f1", pady=10, padx=10, relief=tk.RAISED, bd=2)
        v2_section.pack(fill=tk.X, pady=10)
        
        # Frame con icono
        v2_header = tk.Frame(v2_section, bg="#ecf0f1")
        v2_header.pack(anchor=tk.W, pady=5)
        
        icon_v2 = tk.Label(
            v2_header,
            text="🔄",
            font=("Arial", 20),
            bg="#ecf0f1"
        )
        icon_v2.pack(side=tk.LEFT, padx=(0, 10))
        
        tk.Label(
            v2_header,
            text="⚙️ CONFIGURACIÓN V2",
            font=("Arial", 12, "bold"),
            bg="#ecf0f1",
            fg="#2c3e50"
        ).pack(side=tk.LEFT)
        
        v2_frame = tk.Frame(v2_section, bg="#ecf0f1", pady=5)
        v2_frame.pack(fill=tk.X)
        
        checkbox_v2 = tk.Checkbutton(
            v2_frame,
            text="✅ V2. Combinar gestiones de datos_fuente.xlsx y nuevos_datos.xlsx (eliminando duplicados)",
            variable=self.v2_enabled,
            bg="#ecf0f1",
            font=("Arial", 10),
            cursor="hand2",
            wraplength=800
        )
        checkbox_v2.pack(side=tk.LEFT)
        
        tk.Label(
            v2_frame,
            text="\nSi está activo, combina las gestiones de ambos archivos.\nEjemplo: Si datos_fuente tiene 'IVR,SMS' y nuevos_datos tiene 'IVR,SMS,CALL',\nresultado final será 'IVR, SMS, CALL' (sin duplicados).",
            bg="#ecf0f1",
            font=("Arial", 8),
            fg="#7f8c8d",
            justify=tk.LEFT
        ).pack(side=tk.LEFT, padx=10)
        
        # Configurar scroll para V2
        canvas_v2.bind_all("<MouseWheel>", lambda e: canvas_v2.yview_scroll(int(-1*(e.delta/120)), "units") if self.notebook.index(self.notebook.select()) == 2 else None)
        
        # Pestaña 4: SALIDA Y EJECUCIÓN
        tab_salida = tk.Frame(self.notebook, bg="#f5f5f5")
        self.notebook.add(tab_salida, text="📁 SALIDA")
        
        # Canvas para scroll en pestaña SALIDA
        canvas_salida = tk.Canvas(tab_salida, bg="#f5f5f5", highlightthickness=0)
        scrollbar_salida = ttk.Scrollbar(tab_salida, orient="vertical", command=canvas_salida.yview)
        scrollable_salida = tk.Frame(canvas_salida, bg="#f5f5f5")
        
        scrollable_salida.bind("<Configure>", lambda e: canvas_salida.configure(scrollregion=canvas_salida.bbox("all")))
        canvas_salida.create_window((0, 0), window=scrollable_salida, anchor="nw")
        canvas_salida.configure(yscrollcommand=scrollbar_salida.set)
        
        canvas_salida.pack(side="left", fill="both", expand=True)
        scrollbar_salida.pack(side="right", fill="y")
        
        # Carpeta de salida
        salida_frame = tk.Frame(scrollable_salida, bg="#ecf0f1", pady=10, padx=10, relief=tk.RAISED, bd=2)
        salida_frame.pack(fill=tk.X, pady=15)
        
        tk.Label(
            salida_frame,
            text="📁 CARPETA DE SALIDA:",
            font=("Arial", 12, "bold"),
            bg="#ecf0f1"
        ).pack(side=tk.LEFT, padx=10)
        
        self.carpeta_salida_entry = tk.Entry(salida_frame, width=50, font=("Arial", 10))
        self.carpeta_salida_entry.pack(side=tk.LEFT, padx=5)
        
        tk.Button(
            salida_frame,
            text="📂 Seleccionar",
            command=self.select_carpeta_salida,
            bg="#95a5a6",
            fg="white",
            font=("Arial", 9),
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=5)
        
        # Nombre de carpeta
        nombre_frame = tk.Frame(salida_frame, bg="#ecf0f1")
        nombre_frame.pack(side=tk.LEFT, padx=10)
        
        tk.Label(nombre_frame, text="Nombre:", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT)
        self.nombre_carpeta_entry = tk.Entry(nombre_frame, width=20, font=("Arial", 9))
        self.nombre_carpeta_entry.pack(side=tk.LEFT, padx=5)
        self.nombre_carpeta_entry.insert(0, datetime.now().strftime("evidencias_%d-%m-%y"))
        
        # Botón ejecutar
        ejecutar_frame = tk.Frame(scrollable_salida, bg="#f5f5f5", pady=20)
        ejecutar_frame.pack(fill=tk.X, padx=20)
        
        self.ejecutar_btn = tk.Button(
            ejecutar_frame,
            text="🚀 EJECUTAR PROCESO ✅",
            command=self.ejecutar_proceso,
            bg="#27ae60",
            fg="white",
            font=("Arial", 14, "bold"),
            pady=15,
            cursor="hand2",
            state="disabled"
        )
        self.ejecutar_btn.pack(pady=10)
        
        tk.Button(
            ejecutar_frame,
            text="📊 Simular Resultado",
            command=self.simular_resultado,
            bg="#e67e22",
            fg="white",
            font=("Arial", 11, "bold"),
            pady=8,
            cursor="hand2"
        ).pack(pady=5)
        
        # Configurar scroll para SALIDA
        canvas_salida.bind_all("<MouseWheel>", lambda e: canvas_salida.yview_scroll(int(-1*(e.delta/120)), "units") if self.notebook.index(self.notebook.select()) == 3 else None)
        
        # Pestaña 5: LOGS Y AUDITOR (opcional, para mostrar logs también en principal)
        tab_logs = tk.Frame(self.notebook, bg="#f5f5f5")
        self.notebook.add(tab_logs, text="📋 LOGS")
        
        logs_section_frame = tk.Frame(tab_logs, bg="#ecf0f1", pady=10, padx=10, relief=tk.RAISED, bd=2)
        logs_section_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        tk.Label(
            logs_section_frame,
            text="📋 LOGS",
            font=("Arial", 12, "bold"),
            bg="#ecf0f1"
        ).pack(anchor=tk.W, pady=(0, 10))
        
        # Widget de logs para ventana principal (visible en pestaña LOGS)
        self.logs_text = scrolledtext.ScrolledText(
            logs_section_frame,
            height=20,
            font=("Consolas", 9),
            bg="#2c3e50",
            fg="#ecf0f1",
            wrap=tk.WORD
        )
        self.logs_text.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        # Progress bar (oculto en principal, se usará en ventana de ejecución)
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(
            logs_section_frame,
            variable=self.progress_var,
            maximum=100,
            length=400
        )
        self.progress_bar.pack(pady=5)
        
        # Botón auditor
        auditor_btn = tk.Button(
            logs_section_frame,
            text="🔍 EJECUTAR AUDITOR",
            command=self.ejecutar_auditor,
            bg="#8e44ad",
            fg="white",
            font=("Arial", 11, "bold"),
            pady=8,
            cursor="hand2"
        )
        auditor_btn.pack(pady=10)
        
        # Variables para ventana de ejecución
        self.ejecucion_window = None
        self.progress_label = None
        self.logs_text_ejecucion = None
        self._seccion_base_completa = False
        self._seccion_gestiones_completa = False
        
        # Cache de DataFrames para optimización
        self._df_cache = {}
        self._column_cache = {}
    
    def verificar_seccion_gestiones_completa(self):
        """Verifica si la sección GESTIONES está completa (tiene archivos mínimos)"""
        # Al menos IVR debe tener audio (obligatorio)
        tiene_minimo = self.ivr_base_audio is not None
        
        # Si tiene al menos el audio de IVR, considerar completa
        if tiene_minimo and not hasattr(self, '_seccion_gestiones_completa'):
            self._seccion_gestiones_completa = True
            return True
        return False
        
    def create_section(self, parent, title):
        frame = tk.Frame(parent, bg="#ecf0f1", relief=tk.RAISED, bd=2, pady=10, padx=10)
        frame.pack(fill=tk.X, pady=10)
        
        title_label = tk.Label(
            frame,
            text=title,
            font=("Arial", 14, "bold"),
            bg="#34495e",
            fg="white",
            pady=8
        )
        title_label.pack(fill=tk.X)
        
        content_frame = tk.Frame(frame, bg="#ecf0f1")
        content_frame.pack(fill=tk.X, padx=5, pady=5)
        
        return content_frame
        
    def create_gestion_frame(self, parent, title, archivo1, archivo2=None):
        frame = tk.Frame(parent, bg="#ecf0f1", relief=tk.SUNKEN, bd=1, pady=8, padx=8)
        frame.pack(fill=tk.X, pady=5)
        
        tk.Label(
            frame,
            text=f"{title}: {archivo1}",
            font=("Arial", 11, "bold"),
            bg="#ecf0f1"
        ).pack(anchor=tk.W)
        
        if archivo2:
            tk.Label(
                frame,
                text=archivo2,
                font=("Arial", 10),
                bg="#ecf0f1",
                fg="#7f8c8d"
            ).pack(anchor=tk.W)
        
        return frame
        
    def create_file_selector(self, parent, label, placeholder, command, current_value, filetypes=None, is_directory=False):
        frame = tk.Frame(parent, bg="#ecf0f1", pady=5)
        frame.pack(fill=tk.X)
        
        tk.Label(frame, text=label, font=("Arial", 10), bg="#ecf0f1").pack(side=tk.LEFT, padx=5)
        
        entry = tk.Entry(frame, width=50, font=("Arial", 9))
        entry.pack(side=tk.LEFT, padx=5)
        entry.insert(0, placeholder)
        entry.config(state="readonly", bg="#ffffff")
        frame.entry = entry
        
        btn = tk.Button(
            frame,
            text="📂 Seleccionar",
            command=command,
            bg="#3498db",
            fg="white",
            font=("Arial", 8),
            cursor="hand2",
            padx=5
        )
        btn.pack(side=tk.LEFT, padx=5)
        
        frame.btn = btn
        frame.state = "normal"
        frame.file_path = None
        
        def update_selected(file_path):
            """Actualiza el estado cuando se selecciona un archivo"""
            frame.file_path = file_path
            entry.config(state="normal", bg="#d4edda")
            entry.delete(0, tk.END)
            entry.insert(0, os.path.basename(file_path) if file_path else placeholder)
            entry.config(state="readonly")
            btn.config(text="✅ Seleccionado", bg="#28a745", state="normal")
        
        def disable():
            entry.config(state="normal", bg="#f8d7da")
            entry.delete(0, tk.END)
            entry.insert(0, "Deshabilitado")
            entry.config(state="readonly")
            btn.config(state="disabled", text="📂 Seleccionar", bg="#3498db")
            frame.state = "disabled"
            
        def enable():
            entry.config(state="normal", bg="#ffffff")
            entry.delete(0, tk.END)
            entry.insert(0, placeholder)
            entry.config(state="readonly")
            btn.config(state="normal", text="📂 Seleccionar", bg="#3498db")
            frame.state = "normal"
        
        frame.disable = disable
        frame.enable = enable
        frame.update_selected = update_selected
        
        return frame
        
    def select_datos_fuente(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar datos_fuente.xlsx",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.datos_fuente_path = file_path
            try:
                self.datos_fuente_df = pd.read_excel(file_path)
                self.total_clientes = len(self.datos_fuente_df)
                
                # Actualizar entrada de clientes
                if hasattr(self, 'clientes_entry'):
                    self.clientes_entry.config(state="normal")
                    self.clientes_entry.delete(0, tk.END)
                    self.clientes_entry.insert(0, str(self.total_clientes))
                    self.clientes_entry.config(state="readonly")
                
                # Habilitar selector de nuevos datos
                if hasattr(self, 'nuevos_datos_frame'):
                    self.nuevos_datos_frame.enable()
                
                # Habilitar botón ejecutar si hay carpeta de salida
                if hasattr(self, 'ejecutar_btn') and self.carpeta_salida_path:
                    self.ejecutar_btn.config(state="normal")
                
                # Actualizar estado visual del selector
                if hasattr(self, 'datos_fuente_frame'):
                    self.datos_fuente_frame.update_selected(file_path)
                
                self.log(f"✅ Datos fuente cargados: {self.total_clientes} clientes encontrados")
            except Exception as e:
                messagebox.showerror("Error", f"Error al cargar archivo: {str(e)}")
                
    def select_nuevos_datos(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar nuevos_datos.xlsx",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.nuevos_datos_path = file_path
            try:
                self.nuevos_datos_df = pd.read_excel(file_path)
                self.probar_coincidencia_btn.config(state="normal")
                if hasattr(self, 'nuevos_datos_frame'):
                    self.nuevos_datos_frame.update_selected(file_path)
                self.log(f"✅ Nuevos datos cargados: {len(self.nuevos_datos_df)} registros")
                
                # Paginar a GESTIONES si BASE está completa
                if hasattr(self, 'datos_fuente_df') and self.datos_fuente_df is not None:
                    if not hasattr(self, '_seccion_base_completa'):
                        self.notebook.select(1)  # Cambiar a pestaña GESTIONES
                        self._seccion_base_completa = True
            except Exception as e:
                messagebox.showerror("Error", f"Error al cargar archivo: {str(e)}")
    
    def probar_coincidencia(self):
        if self.datos_fuente_df is None or self.nuevos_datos_df is None:
            messagebox.showwarning("Advertencia", "Debe cargar ambos archivos primero")
            return
            
        no_coinciden = []
        
        # Normalizar nombres de columnas
        gestion_efectiva_col = None
        cuenta_fuente_col = None
        
        for col in self.datos_fuente_df.columns:
            if "GESTION EFECTIVA" in str(col).upper():
                gestion_efectiva_col = col
            if "CUENTA" in str(col).upper():
                cuenta_fuente_col = col
        
        tipo_gestion_col = None
        cuenta_nuevos_col = None
        
        for col in self.nuevos_datos_df.columns:
            if "TIPO DE GESTION" in str(col).upper() or "TIPO GESTION" in str(col).upper():
                tipo_gestion_col = col
            if "CUENTA" in str(col).upper():
                cuenta_nuevos_col = col
        
        if not gestion_efectiva_col or not cuenta_fuente_col or not tipo_gestion_col or not cuenta_nuevos_col:
            messagebox.showerror("Error", "No se encontraron las columnas necesarias en los archivos")
            return
        
        # Buscar coincidencias
        for idx, row_fuente in self.datos_fuente_df.iterrows():
            cuenta_fuente = str(row_fuente[cuenta_fuente_col]).strip()
            gestion_fuente = str(row_fuente[gestion_efectiva_col]).strip()
            
            # Buscar en nuevos datos
            matches = self.nuevos_datos_df[self.nuevos_datos_df[cuenta_nuevos_col].astype(str).str.strip() == cuenta_fuente]
            
            if len(matches) > 0:
                gestion_nueva = str(matches.iloc[0][tipo_gestion_col]).strip()
                
                # Normalizar gestiones (CALL = GRABACION CALL)
                gestion_fuente_norm = gestion_fuente.replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL")
                gestion_nueva_norm = gestion_nueva.replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL")
                
                # Verificar si hay diferencias
                gestiones_fuente = [g.strip() for g in gestion_fuente_norm.split(",")]
                gestiones_nueva = [g.strip() for g in gestion_nueva_norm.split(",")]
                
                if set(gestiones_fuente) != set(gestiones_nueva):
                    nombre_cliente = str(row_fuente.get("NOMBRE", row_fuente.get("CLIENTE", "N/A"))).strip()
                    no_coinciden.append({
                        "id": len(no_coinciden) + 1,
                        "cuenta": cuenta_fuente,
                        "nombre": nombre_cliente,
                        "datos_fuente": gestion_fuente,
                        "nuevos_datos": gestion_nueva
                    })
        
        if no_coinciden:
            self.mostrar_no_coincidencias(no_coinciden)
        else:
            messagebox.showinfo("Coincidencia", "✅ Todas las gestiones coinciden correctamente")
    
    def mostrar_no_coincidencias(self, no_coinciden):
        window = tk.Toplevel(self.root)
        window.title("Clientes que no coinciden")
        window.geometry("800x500")
        window.configure(bg="#ecf0f1")
        
        # Frame con scrollbar
        frame = tk.Frame(window, bg="#ecf0f1")
        frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Headers
        headers = ["ID", "CUENTA", "NOMBRE", "DATOS_FUENTE", "NUEVOS_DATOS"]
        for i, header in enumerate(headers):
            label = tk.Label(
                frame,
                text=header,
                font=("Arial", 10, "bold"),
                bg="#34495e",
                fg="white",
                width=20,
                padx=5
            )
            label.grid(row=0, column=i, sticky="ew", padx=2, pady=2)
        
        # Data
        for idx, item in enumerate(no_coinciden, 1):
            tk.Label(frame, text=str(item["id"]), bg="#ecf0f1", width=20).grid(row=idx, column=0, padx=2, pady=2)
            tk.Label(frame, text=item["cuenta"], bg="#ecf0f1", width=20).grid(row=idx, column=1, padx=2, pady=2)
            tk.Label(frame, text=item["nombre"][:30], bg="#ecf0f1", width=20).grid(row=idx, column=2, padx=2, pady=2)
            tk.Label(frame, text=item["datos_fuente"][:30], bg="#ecf0f1", width=20).grid(row=idx, column=3, padx=2, pady=2)
            tk.Label(frame, text=item["nuevos_datos"][:30], bg="#ecf0f1", width=20).grid(row=idx, column=4, padx=2, pady=2)
        
        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=1)
        frame.columnconfigure(2, weight=1)
        frame.columnconfigure(3, weight=1)
        frame.columnconfigure(4, weight=1)
    
    def select_ivr_base_excel(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo base IVR",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.ivr_base_excel = file_path
            if hasattr(self, 'ivr_base_excel_frame'):
                self.ivr_base_excel_frame.update_selected(file_path)
            
            # Si el checkbox IVR para CALL está activo, actualizar estado visual
            if self.ivr_use_for_call.get() and hasattr(self, 'call_gestiones_frame'):
                self.call_gestiones_frame.btn.config(text="✅ Seleccionado (IVR)", bg="#28a745", state="normal")
            
            self.log(f"✅ Archivo base IVR seleccionado: {os.path.basename(file_path)}")
            
            # Verificar si GESTIONES está completa y paginar a V2
            if self.verificar_seccion_gestiones_completa():
                self.notebook.select(2)  # Cambiar a pestaña V2
    
    def select_ivr_base_audio(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar audio base IVR",
            filetypes=[("MP3 files", "*.mp3")]
        )
        if file_path and file_path.lower().endswith('.mp3'):
            self.ivr_base_audio = file_path
            if hasattr(self, 'ivr_base_audio_frame'):
                self.ivr_base_audio_frame.update_selected(file_path)
            self.log(f"✅ Audio base IVR seleccionado: {os.path.basename(file_path)}")
            
            # Verificar si GESTIONES está completa y paginar a V2
            if self.verificar_seccion_gestiones_completa():
                self.notebook.select(2)  # Cambiar a pestaña V2
        else:
            messagebox.showerror("Error", "Debe seleccionar un archivo MP3")
    
    def select_sms_base_excel(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo base SMS",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.sms_base_excel = file_path
            if hasattr(self, 'sms_base_excel_frame'):
                self.sms_base_excel_frame.update_selected(file_path)
            self.log(f"✅ Archivo base SMS seleccionado: {os.path.basename(file_path)}")
            
            # Verificar si GESTIONES está completa y paginar a V2
            if self.verificar_seccion_gestiones_completa():
                self.notebook.select(2)  # Cambiar a pestaña V2
    
    def select_call_gestiones_excel(self):
        if self.ivr_use_for_call.get():
            messagebox.showinfo("Información", "El archivo de gestiones CALL usará el mismo archivo base IVR")
            return
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo gestiones CALL",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.call_gestiones_excel = file_path
            if hasattr(self, 'call_gestiones_frame'):
                self.call_gestiones_frame.update_selected(file_path)
            self.log(f"✅ Archivo gestiones CALL seleccionado: {os.path.basename(file_path)}")
    
    def select_call_consolidado_excel(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar reporte consolidado CALL",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.call_consolidado_excel = file_path
            if hasattr(self, 'call_consolidado_frame'):
                self.call_consolidado_frame.update_selected(file_path)
            
            # Deshabilitar selector de audios físicos cuando se selecciona archivo call
            if hasattr(self, 'call_audios_fisicos_frame'):
                self.call_audios_fisicos_frame.disable()
                self.call_audios_fisicos_frame.entry.config(state="normal")
                self.call_audios_fisicos_frame.entry.delete(0, tk.END)
                self.call_audios_fisicos_frame.entry.insert(0, "Los audios se buscarán en el archivo call")
                self.call_audios_fisicos_frame.entry.config(state="readonly", bg="#fff3cd")
                self.call_audios_fisicos_path = None  # Limpiar path ya que no se usará
            
            self.log(f"✅ Reporte consolidado CALL seleccionado: {os.path.basename(file_path)}")
    
    def limpiar_call_consolidado(self):
        """Permite limpiar la selección del archivo call consolidado para habilitar audios físicos"""
        if hasattr(self, 'call_consolidado_frame'):
            self.call_consolidado_excel = None
            self.call_consolidado_frame.entry.config(state="normal")
            self.call_consolidado_frame.entry.delete(0, tk.END)
            self.call_consolidado_frame.entry.insert(0, "reporte_consolidado.xlsx")
            self.call_consolidado_frame.entry.config(state="readonly", bg="white")
            self.call_consolidado_frame.btn.config(text="📂 Seleccionar", bg="#3498db", state="normal")
            
            # Re-habilitar selector de audios físicos
            if hasattr(self, 'call_audios_fisicos_frame'):
                self.call_audios_fisicos_frame.enable()
                self.call_audios_fisicos_frame.entry.config(state="normal")
                self.call_audios_fisicos_frame.entry.delete(0, tk.END)
                self.call_audios_fisicos_frame.entry.insert(0, "carpetas")
                self.call_audios_fisicos_frame.entry.config(state="readonly", bg="white")
            
            self.log("🗑️ Selección de archivo call consolidado limpiada")
    
    def toggle_call_gestiones_selector(self):
        """Habilita/deshabilita el selector de gestiones CALL según el checkbox IVR"""
        if hasattr(self, 'call_gestiones_frame'):
            if self.ivr_use_for_call.get():
                self.call_gestiones_frame.disable()
                self.call_gestiones_frame.entry.config(state="normal")
                self.call_gestiones_frame.entry.delete(0, tk.END)
                self.call_gestiones_frame.entry.insert(0, "Usará el mismo archivo base IVR")
                self.call_gestiones_frame.entry.config(state="readonly", bg="#fff3cd")
                # Actualizar estado visual para mostrar como seleccionado
                self.call_gestiones_frame.btn.config(text="✅ Seleccionado (IVR)", bg="#28a745", state="normal")
            else:
                self.call_gestiones_frame.enable()
                # Si había sido deshabilitado por el checkbox, restaurar estado normal
                if self.call_gestiones_excel:
                    self.call_gestiones_frame.update_selected(self.call_gestiones_excel)
                else:
                    self.call_gestiones_frame.btn.config(text="📂 Seleccionar", bg="#3498db")
    
    def select_call_audios_fisicos(self):
        dir_path = filedialog.askdirectory(title="Seleccionar carpeta de audios físicos")
        if dir_path:
            self.call_audios_fisicos_path = dir_path
            if hasattr(self, 'call_audios_fisicos_frame'):
                self.call_audios_fisicos_frame.update_selected(dir_path)
            self.log(f"✅ Carpeta de audios físicos seleccionada: {dir_path}")
    
    def select_carpeta_salida(self):
        dir_path = filedialog.askdirectory(title="Seleccionar carpeta de salida")
        if dir_path:
            self.carpeta_salida_path = dir_path
            self.carpeta_salida_entry.delete(0, tk.END)
            self.carpeta_salida_entry.insert(0, dir_path)
            
            # Habilitar botón ejecutar si hay datos fuente
            if hasattr(self, 'ejecutar_btn') and self.datos_fuente_df is not None:
                self.ejecutar_btn.config(state="normal")
            
            self.log(f"✅ Carpeta de salida seleccionada: {dir_path}")
            
            # Paginar automáticamente: si ya se seleccionó carpeta, mantener en SALIDA
            # (el botón ejecutar ya habilita, no necesita paginar más)
    
    def log(self, message):
        """Log a message to the appropriate logs widget"""
        # Determinar qué widget(s) de logs usar
        logs_widgets = [self.logs_text]  # Siempre escribir en la ventana principal
        if hasattr(self, 'logs_text_ejecucion') and self.logs_text_ejecucion:
            logs_widgets.append(self.logs_text_ejecucion)  # También en ventana de ejecución si existe
        
        # Optimización: solo actualizar UI ocasionalmente para mejorar rendimiento
        timestamp = datetime.now().strftime("%H:%M:%S")
        for logs_widget in logs_widgets:
            if logs_widget:
                logs_widget.insert(tk.END, f"[{timestamp}] {message}\n")
        
        # Solo hacer scroll y update cada N mensajes para optimizar
        if hasattr(self, '_log_count'):
            self._log_count += 1
        else:
            self._log_count = 0
        
        if self._log_count % 5 == 0:  # Update cada 5 logs
            for logs_widget in logs_widgets:
                if logs_widget:
                    logs_widget.see(tk.END)
            # Actualizar la ventana correcta
            window = self.ejecucion_window if hasattr(self, 'ejecucion_window') and self.ejecucion_window else self.root
            window.update_idletasks()  # Usar update_idletasks en lugar de update para mejorar rendimiento
    
    def ejecutar_proceso(self):
        if not self.validar_datos():
            return
        
        # Crear ventana de ejecución
        self.abrir_ventana_ejecucion()
    
    def abrir_ventana_ejecucion(self):
        """Abre una nueva ventana solo con logs y progreso"""
        # Crear nueva ventana
        self.ejecucion_window = tk.Toplevel(self.root)
        self.ejecucion_window.title("📋 Procesando Evidencias...")
        self.ejecucion_window.geometry("900x600")
        self.ejecucion_window.configure(bg="#2c3e50")
        
        # No permitir cerrar durante ejecución
        self.ejecucion_window.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # Header con decoración
        header_frame = tk.Frame(self.ejecucion_window, bg="#2c3e50", pady=20)
        header_frame.pack(fill=tk.X)
        
        # Frame interno para alinear
        header_inner = tk.Frame(header_frame, bg="#2c3e50")
        header_inner.pack()
        
        # Icono decorativo
        icon_exec = tk.Label(
            header_inner,
            text="⚙️",
            font=("Arial", 36),
            bg="#2c3e50",
            fg="white"
        )
        icon_exec.pack(side=tk.LEFT, padx=(0, 15))
        
        title_exec = tk.Label(
            header_inner,
            text="PROCESANDO EVIDENCIAS",
            font=("Arial", 20, "bold"),
            bg="#2c3e50",
            fg="white"
        )
        title_exec.pack(side=tk.LEFT)
        
        # Subtítulo
        subtitle_exec = tk.Label(
            header_frame,
            text="Generando documentación y archivos de evidencia...",
            font=("Arial", 10),
            bg="#2c3e50",
            fg="#ecf0f1"
        )
        subtitle_exec.pack(pady=(5, 0))
        
        # Frame principal
        main_exec_frame = tk.Frame(self.ejecucion_window, bg="#34495e")
        main_exec_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Logs
        logs_label = tk.Label(
            main_exec_frame,
            text="📋 LOGS",
            font=("Arial", 14, "bold"),
            bg="#34495e",
            fg="white"
        )
        logs_label.pack(anchor=tk.W, pady=(0, 10))
        
        # Crear nuevo widget de logs para ventana de ejecución
        self.logs_text_ejecucion = scrolledtext.ScrolledText(
            main_exec_frame,
            height=20,
            font=("Consolas", 10),
            bg="#2c3e50",
            fg="#ecf0f1",
            wrap=tk.WORD
        )
        self.logs_text_ejecucion.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        # Progress bar
        progress_frame = tk.Frame(main_exec_frame, bg="#34495e")
        progress_frame.pack(fill=tk.X, pady=10)
        
        tk.Label(
            progress_frame,
            text="Progreso:",
            font=("Arial", 11, "bold"),
            bg="#34495e",
            fg="white"
        ).pack(side=tk.LEFT, padx=(0, 10))
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar_ejecucion = ttk.Progressbar(
            progress_frame,
            variable=self.progress_var,
            maximum=100,
            length=600
        )
        self.progress_bar_ejecucion.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        self.progress_label = tk.Label(
            progress_frame,
            text="0%",
            font=("Arial", 11, "bold"),
            bg="#34495e",
            fg="white",
            width=5
        )
        self.progress_label.pack(side=tk.LEFT)
        
        # Botón cancelar (para futuro)
        btn_frame = tk.Frame(main_exec_frame, bg="#34495e")
        btn_frame.pack(fill=tk.X, pady=10)
        
        # Iniciar procesamiento en hilo separado
        import threading
        thread = threading.Thread(target=self.ejecutar_proceso_background, daemon=True)
        thread.start()
    
    def ejecutar_proceso_background(self):
        """Ejecuta el proceso en background y actualiza la ventana de ejecución"""
        # Limpiar logs en la ventana de ejecución
        self.logs_text_ejecucion.delete(1.0, tk.END)
        
        self.progress_var.set(0)
        
        # Limpiar registro de archivos no creados y cache
        self.archivos_no_creados = {
            "ivr_sin_match": [],
            "sms_sin_match": [],
            "call_sin_match": [],
            "ivr_sin_audio": [],
            "call_sin_audio": [],
            "carpetas_vacias": []
        }
        self._df_cache.clear()
        self._column_cache.clear()
        
        try:
            # Pre-cargar todos los DataFrames necesarios (optimización)
            self.log("📦 Precargando archivos Excel...")
            if self.ivr_base_excel and os.path.exists(self.ivr_base_excel):
                self._df_cache['ivr'] = pd.read_excel(self.ivr_base_excel)
            if self.sms_base_excel and os.path.exists(self.sms_base_excel):
                self._df_cache['sms'] = pd.read_excel(self.sms_base_excel)
            if self.call_consolidado_excel and os.path.exists(self.call_consolidado_excel):
                self._df_cache['call'] = pd.read_excel(self.call_consolidado_excel)
            
            # Pre-cargar archivos de gestiones si son diferentes
            archivo_gestiones = None
            if self.ivr_use_for_call.get() and self.ivr_base_excel:
                archivo_gestiones = self.ivr_base_excel
            elif self.call_gestiones_excel:
                archivo_gestiones = self.call_gestiones_excel
            
            if archivo_gestiones and os.path.exists(archivo_gestiones):
                self._df_cache['gestiones'] = pd.read_excel(archivo_gestiones)
            
            self.log("✅ Archivos precargados correctamente")
            
            # Crear carpeta principal
            if hasattr(self, 'nombre_carpeta_entry') and self.nombre_carpeta_entry.get():
                nombre_carpeta = self.nombre_carpeta_entry.get()
            else:
                nombre_carpeta = datetime.now().strftime("evidencias_%d-%m-%y")
            
            carpeta_principal = os.path.join(self.carpeta_salida_path, nombre_carpeta)
            os.makedirs(carpeta_principal, exist_ok=True)
            
            total = len(self.datos_fuente_df)
            update_interval = max(1, total // 20)  # Actualizar cada ~5%
            
            for idx, cliente_row in self.datos_fuente_df.iterrows():
                try:
                    self.procesar_cliente(cliente_row, carpeta_principal)
                    progress = ((idx + 1) / total) * 100
                    self.progress_var.set(progress)
                    
                    # Mostrar avance solo cada intervalo o al final
                    if (idx + 1) % update_interval == 0 or (idx + 1) == total:
                        self.progress_label.config(text=f"{progress:.0f}%")
                        barra = "|" * int(progress / 10) + "." * (10 - int(progress / 10))
                        self.log(f"AVANCE: {barra} {progress:.0f}%")
                        self.ejecucion_window.update_idletasks()  # Actualizar UI solo ocasionalmente
                except Exception as e:
                    pass
            
            self.progress_var.set(100)
            self.progress_label.config(text="100%")
            self.log("✅ Proceso completado exitosamente")
            
            # Mostrar botón de cerrar
            btn_cerrar = tk.Button(
                self.ejecucion_window,
                text="✅ Cerrar",
                command=self.cerrar_ventana_ejecucion,
                bg="#27ae60",
                fg="white",
                font=("Arial", 12, "bold"),
                pady=10,
                cursor="hand2"
            )
            btn_cerrar.pack(pady=20)
            
            messagebox.showinfo("Éxito", f"Proceso completado exitosamente.\nTotal de carpetas creadas: {total}", parent=self.ejecucion_window)
            
        except Exception as e:
            self.log(f"❌ Error en el proceso: {str(e)}")
            messagebox.showerror("Error", f"Error en el proceso: {str(e)}", parent=self.ejecucion_window)
        
        finally:
            # Permitir cerrar ventana
            self.ejecucion_window.protocol("WM_DELETE_WINDOW", self.cerrar_ventana_ejecucion)
    
    def cerrar_ventana_ejecucion(self):
        """Cierra la ventana de ejecución"""
        if self.ejecucion_window:
            self.ejecucion_window.destroy()
            self.ejecucion_window = None
            self.ejecutar_btn.config(state="normal")
    
    def validar_datos(self):
        if self.datos_fuente_df is None:
            messagebox.showerror("Error", "Debe cargar datos_fuente.xlsx")
            return False
        if not self.carpeta_salida_path:
            messagebox.showerror("Error", "Debe seleccionar carpeta de salida")
            return False
        return True
    
    def procesar_cliente(self, cliente_row, carpeta_principal):
        # Obtener datos del cliente
        nombre_cliente = str(cliente_row.get("NOMBRE", cliente_row.get("CLIENTE", "Sin nombre"))).strip()
        cuenta_cliente = str(cliente_row.get("CUENTA", "")).strip()
        gestion_efectiva = str(cliente_row.get("GESTION EFECTIVA", "")).strip()
        
        # Normalizar gestiones (siempre a mayúsculas y sin GRABACION CALL)
        gestiones = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                     for g in gestion_efectiva.split(",") if g.strip()]
        
        # Si V2 está activo, combinar gestiones de datos_fuente y nuevos_datos (sin duplicados)
        if self.v2_enabled.get() and self.nuevos_datos_df is not None:
            gestiones = self.obtener_gestiones_v2(cuenta_cliente, gestiones)
        
        # Crear carpeta del cliente
        nombre_carpeta_cliente = f"{nombre_cliente}_{cuenta_cliente}"
        nombre_carpeta_cliente = self.sanitize_filename(nombre_carpeta_cliente)
        carpeta_cliente = os.path.join(carpeta_principal, nombre_carpeta_cliente)
        os.makedirs(carpeta_cliente, exist_ok=True)
        
        # Log de cliente y gestiones
        gestiones_str = ', '.join(gestiones) if gestiones else 'NINGUNA'
        self.log(f"->[{nombre_cliente}]: [{gestiones_str}]")
        
        # Orden de procesamiento: IVR → SMS → CALL (sin importar el orden original)
        orden_procesamiento = ["IVR", "SMS", "CALL"]
        
        # Procesar cada gestión en el orden correcto (sin detenerse si una falla)
        for gestion_ordenada in orden_procesamiento:
            if gestion_ordenada in gestiones:
                try:
                    if gestion_ordenada == "IVR":
                        self.procesar_ivr(cliente_row, carpeta_cliente, nombre_cliente)
                    elif gestion_ordenada == "SMS":
                        self.procesar_sms(cliente_row, carpeta_cliente, nombre_cliente)
                    elif gestion_ordenada == "CALL":
                        self.procesar_call(cliente_row, carpeta_cliente, nombre_cliente, cuenta_cliente)
                except Exception as e:
                    # Error crítico, pero continuar
                    pass
    
    def obtener_gestiones_v2(self, cuenta_cliente, gestiones_actuales):
        """Combina gestiones de datos_fuente y nuevos_datos eliminando duplicados"""
        if self.nuevos_datos_df is None:
            self.log(f"    ⚠️ V2: nuevos_datos_df no está cargado")
            return gestiones_actuales
        
        # Buscar cliente en nuevos_datos por CUENTA
        cuenta_col = None
        tipo_gestion_col = None
        
        for col in self.nuevos_datos_df.columns:
            if "CUENTA" in str(col).upper():
                cuenta_col = col
            if "TIPO DE GESTION" in str(col).upper() or "TIPO GESTION" in str(col).upper():
                tipo_gestion_col = col
        
        if not cuenta_col or not tipo_gestion_col:
            self.log(f"    ⚠️ V2: Columnas no encontradas - CUENTA: {cuenta_col}, TIPO_GESTION: {tipo_gestion_col}")
            return gestiones_actuales
        
        # Normalizar gestiones actuales
        gestiones_actuales_norm = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                                   for g in gestiones_actuales if g.strip()]
        
        # Buscar todas las filas que coincidan con la cuenta
        cuenta_buscar = str(cuenta_cliente).strip()
        matches = self.nuevos_datos_df[
            self.nuevos_datos_df[cuenta_col].astype(str).str.strip() == cuenta_buscar
        ]
        
        nuevas_gestiones_list = []
        
        if len(matches) > 0:
            # Obtener gestiones de todas las filas coincidentes
            for _, row in matches.iterrows():
                tipo_gestion = str(row[tipo_gestion_col]).strip()
                if tipo_gestion and tipo_gestion.upper() != "NAN" and tipo_gestion.upper() != "NONE":
                    nuevas_gestiones = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                                       for g in tipo_gestion.split(",") if g.strip()]
                    nuevas_gestiones_list.extend(nuevas_gestiones)
        else:
            self.log(f"    ⚠️ V2: No se encontró cuenta {cuenta_buscar} en nuevos_datos")
        
        # Combinar ambas listas y eliminar duplicados (case-insensitive)
        todas_gestiones_set = set()
        
        # Agregar gestiones actuales
        for gest in gestiones_actuales_norm:
            todas_gestiones_set.add(gest.upper())
        
        # Agregar nuevas gestiones
        for gest in nuevas_gestiones_list:
            todas_gestiones_set.add(gest.upper())
        
        # Convertir a lista ordenada (mantener orden: IVR, SMS, CALL primero)
        orden_preferido = ["IVR", "SMS", "CALL", "WHATSAPP", "EMAIL", "OTROS"]
        todas_gestiones = []
        
        # Primero agregar en orden preferido
        for gest_pref in orden_preferido:
            if gest_pref in todas_gestiones_set:
                todas_gestiones.append(gest_pref)
                todas_gestiones_set.remove(gest_pref)
        
        # Luego agregar las que quedan
        todas_gestiones.extend(sorted(todas_gestiones_set))
        
        if len(todas_gestiones) > len(gestiones_actuales_norm):
            self.log(f"    ✅ V2: Gestiones combinadas - Antes: {', '.join(gestiones_actuales_norm)} | Después: {', '.join(todas_gestiones)}")
        
        return todas_gestiones
    
    def procesar_ivr(self, cliente_row, carpeta_cliente, nombre_cliente):
        archivos_creados = []
        
        # El archivo MP3 es OBLIGATORIO si hay gestión IVR
        if not self.ivr_base_audio:
            self.archivos_no_creados["ivr_sin_audio"].append(nombre_cliente)
        else:
            # Copiar audio OBLIGATORIO
            try:
                nombre_audio = f"ivr_{self.sanitize_filename(nombre_cliente)}.mp3"
                archivo_audio = os.path.join(carpeta_cliente, nombre_audio)
                
                if os.path.exists(self.ivr_base_audio):
                    shutil.copy2(self.ivr_base_audio, archivo_audio)
                    archivos_creados.append("mp3")
            except:
                self.archivos_no_creados["ivr_sin_audio"].append(nombre_cliente)
        
            # Procesar Excel (opcional, solo si hay archivo base) - Usar cache
            excel_creado = False
            if self.ivr_base_excel and 'ivr' in self._df_cache:
                try:
                    df_ivr = self._df_cache['ivr']  # Usar DataFrame cacheado
                    match_cliente_col = self.ivr_match_cliente_combo.get()
                    match_archivo_col = self.ivr_match_archivo_combo.get()
                    cuenta_cliente = str(cliente_row.get(match_cliente_col, "")).strip()
                    
                    if match_archivo_col in df_ivr.columns:
                        cliente_data = df_ivr[df_ivr[match_archivo_col].astype(str).str.strip() == cuenta_cliente]
                        
                        # Cachear búsqueda de columna GESTION EFECTIVA
                        cache_key = 'ivr_gestion_col'
                        if cache_key not in self._column_cache:
                            gestion_col = None
                            for col in df_ivr.columns:
                                if "GESTION EFECTIVA" in str(col).upper():
                                    gestion_col = col
                                    break
                            self._column_cache[cache_key] = gestion_col
                        gestion_col = self._column_cache[cache_key]
                        
                        if gestion_col:
                            cliente_data = cliente_data[cliente_data[gestion_col].astype(str).str.contains("IVR", case=False, na=False)]
                        
                        if len(cliente_data) > 0:
                            cliente_data = cliente_data.copy()
                            cliente_data["TIPO DE GESTION"] = "IVR"
                            nombre_archivo = f"{self.sanitize_filename(nombre_cliente)}_ivr.xlsx"
                            archivo_excel = os.path.join(carpeta_cliente, nombre_archivo)
                            cliente_data.to_excel(archivo_excel, index=False)
                            excel_creado = True
                            archivos_creados.append("xlsx")
                except:
                    pass
        
        # Log resumido
        if len(archivos_creados) == 2:
            self.log(f"  ->IVR: 2 archivos creados (xlsx, mp3)")
        elif len(archivos_creados) == 1 and "mp3" in archivos_creados:
            self.log(f"  ->IVR: 1 archivo creado (mp3)")
        elif not excel_creado and self.ivr_base_excel:
            self.log(f"  ->IVR: Sin match en archivo base")
            self.archivos_no_creados["ivr_sin_match"].append(nombre_cliente)
        else:
            self.log(f"  ->IVR: 1 archivo creado (xlsx)")
    
    def procesar_sms(self, cliente_row, carpeta_cliente, nombre_cliente):
        if not self.sms_base_excel or 'sms' not in self._df_cache:
            return
        
        try:
            df_sms = self._df_cache['sms']  # Usar DataFrame cacheado
            match_cliente_col = self.sms_match_cliente_combo.get()
            match_archivo_col = self.sms_match_archivo_combo.get()
            valor_cliente = str(cliente_row.get(match_cliente_col, "")).strip()
            
            if match_archivo_col in df_sms.columns:
                cliente_data = df_sms[df_sms[match_archivo_col].astype(str).str.strip() == valor_cliente]
                
                if len(cliente_data) > 0:
                    nombre_archivo = f"SMS_{self.sanitize_filename(nombre_cliente)}.xlsx"
                    archivo_excel = os.path.join(carpeta_cliente, nombre_archivo)
                    cliente_data.to_excel(archivo_excel, index=False)
                    self.log(f"  ->SMS: Archivo creado")
                    return
            
            self.log(f"  ->SMS: Sin match en archivo base")
            self.archivos_no_creados["sms_sin_match"].append(nombre_cliente)
        except:
            self.archivos_no_creados["sms_sin_match"].append(nombre_cliente)
    
    def procesar_call(self, cliente_row, carpeta_cliente, nombre_cliente, cuenta_cliente):
        cuenta_valor = str(cliente_row.get("CUENTA", "")).strip()
        telefono_cliente = str(cliente_row.get("TELEFONO", "")).strip()
        archivos_creados = []
        
        # Verificar si tenemos el archivo consolidado
        if not self.call_consolidado_excel:
            return
        
        # Intentar crear Excel de gestiones (opcional)
        excel_creado = False
        archivo_gestiones = None
        if self.ivr_use_for_call.get() and self.ivr_base_excel:
            archivo_gestiones = self.ivr_base_excel
        elif self.call_gestiones_excel:
            archivo_gestiones = self.call_gestiones_excel
        
        if archivo_gestiones and 'gestiones' in self._df_cache:
            try:
                df_gestiones = self._df_cache['gestiones']  # Usar DataFrame cacheado
                
                # Cachear búsqueda de columna CUENTA
                cache_key_cuenta = 'gestiones_cuenta_col'
                if cache_key_cuenta not in self._column_cache:
                    cuenta_col_name = None
                    for col in df_gestiones.columns:
                        if "CUENTA" in str(col).upper():
                            cuenta_col_name = col
                            break
                    self._column_cache[cache_key_cuenta] = cuenta_col_name
                cuenta_col_name = self._column_cache[cache_key_cuenta]
                
                if cuenta_col_name:
                    cliente_data = df_gestiones[df_gestiones[cuenta_col_name].astype(str).str.strip() == cuenta_valor]
                    
                    # Cachear búsqueda de columna GESTION EFECTIVA
                    cache_key_gestion = 'gestiones_gestion_col'
                    if cache_key_gestion not in self._column_cache:
                        gestion_col = None
                        for col in df_gestiones.columns:
                            if "GESTION EFECTIVA" in str(col).upper():
                                gestion_col = col
                                break
                        self._column_cache[cache_key_gestion] = gestion_col
                    gestion_col = self._column_cache[cache_key_gestion]
                    
                    if gestion_col:
                        cliente_data = cliente_data[cliente_data[gestion_col].astype(str).str.contains("CALL", case=False, na=False)]
                    
                    if len(cliente_data) > 0:
                        cliente_data = cliente_data.copy()
                        cliente_data["TIPO DE GESTION"] = "CALL"
                        nombre_archivo = f"{self.sanitize_filename(nombre_cliente)}_gestiones.xlsx"
                        archivo_excel = os.path.join(carpeta_cliente, nombre_archivo)
                        cliente_data.to_excel(archivo_excel, index=False)
                        excel_creado = True
                        archivos_creados.append("xlsx")
            except:
                pass
        
        # PROCESAR AUDIO (OBLIGATORIO) - Usar cache
        if not telefono_cliente:
            self.archivos_no_creados["call_sin_audio"].append(nombre_cliente)
            return
        
        try:
            if 'call' not in self._df_cache:
                return
            df_call = self._df_cache['call']  # Usar DataFrame cacheado
            
            # Cachear búsqueda de columnas (solo una vez)
            if 'call_numero_col' not in self._column_cache:
                numero_col = None
                ruta_col = None
                
                # Buscar columna numero_celular
                for col in df_call.columns:
                    col_clean = str(col).strip().upper().replace("_", "").replace("-", "").replace(" ", "")
                    if col_clean == "NUMEROCELULAR":
                        numero_col = col
                        break
                
                if not numero_col:
                    for col in df_call.columns:
                        col_upper = str(col).upper()
                        if "NUMERO" in col_upper and "CELULAR" in col_upper:
                            numero_col = col
                            break
                
                # Buscar columna ruta
                for col in df_call.columns:
                    if str(col).strip().lower() == "ruta":
                        ruta_col = col
                        break
                
                if not ruta_col:
                    for col in df_call.columns:
                        col_upper = str(col).strip().upper()
                        if col_upper == "RUTA":
                            ruta_col = col
                            break
                
                self._column_cache['call_numero_col'] = numero_col
                self._column_cache['call_ruta_col'] = ruta_col
                
                # Preprocesar: convertir a string una sola vez
                if numero_col:
                    df_call[numero_col] = df_call[numero_col].astype(str).str.strip()
            
            numero_col = self._column_cache.get('call_numero_col')
            ruta_col = self._column_cache.get('call_ruta_col')
            
            if numero_col and ruta_col:
                audio_match = df_call[df_call[numero_col] == telefono_cliente]
                
                if len(audio_match) > 0:
                    ruta_audio = str(audio_match.iloc[0][ruta_col]).strip().replace('"', '').replace("'", "").strip()
                    
                    if ruta_audio and ruta_audio.upper() not in ["NAN", "NONE", ""] and os.path.exists(ruta_audio):
                        nombre_audio = f"{self.sanitize_filename(nombre_cliente)}_{cuenta_valor}.mp3"
                        archivo_audio_destino = os.path.join(carpeta_cliente, nombre_audio)
                        shutil.copy2(ruta_audio, archivo_audio_destino)
                        archivos_creados.append("mp3")
                    else:
                        self.archivos_no_creados["call_sin_audio"].append(nombre_cliente)
                else:
                    # Sin match en numero_celular - SÍ se debe mostrar
                    self.archivos_no_creados["call_sin_match"].append(nombre_cliente)
        except:
            self.archivos_no_creados["call_sin_audio"].append(nombre_cliente)
        
        # Log resumido
        if len(archivos_creados) == 2:
            self.log(f"  ->CALL: 2 archivos creados (xlsx, mp3)")
        elif len(archivos_creados) == 1 and "mp3" in archivos_creados:
            self.log(f"  ->CALL: 1 archivo creado (mp3)")
        elif not telefono_cliente or len(archivos_creados) == 0:
            if nombre_cliente in self.archivos_no_creados["call_sin_match"]:
                self.log(f"  ->CALL: Sin match en numero_celular")
            else:
                self.log(f"  ->CALL: Sin match en archivo base")
                if archivo_gestiones:
                    self.archivos_no_creados["call_sin_match"].append(nombre_cliente)
    
    def buscar_audio_fisico(self, ruta_relativa):
        """Busca el audio físico en la carpeta de audios"""
        if not self.call_audios_fisicos_path:
            return None
        
        # Normalizar ruta
        nombre_archivo = os.path.basename(ruta_relativa)
        
        # Buscar recursivamente
        for root, dirs, files in os.walk(self.call_audios_fisicos_path):
            if nombre_archivo in files:
                return os.path.join(root, nombre_archivo)
        
        return None
    
    def sanitize_filename(self, filename):
        """Limpia el nombre de archivo de caracteres inválidos"""
        filename = re.sub(r'[<>:"/\\|?*]', '', filename)
        return filename.strip()
    
    def simular_resultado(self):
        if self.datos_fuente_df is None:
            messagebox.showwarning("Advertencia", "Debe cargar datos_fuente.xlsx primero")
            return
        
        # Ventana de simulación
        sim_window = tk.Toplevel(self.root)
        sim_window.title("Simulación de Resultado")
        sim_window.geometry("900x700")
        sim_window.configure(bg="#ecf0f1")
        
        # Opciones de formato
        formato_frame = tk.Frame(sim_window, bg="#34495e", pady=10)
        formato_frame.pack(fill=tk.X)
        
        tk.Label(
            formato_frame,
            text="Formato de salida:",
            font=("Arial", 10, "bold"),
            bg="#34495e",
            fg="white"
        ).pack(side=tk.LEFT, padx=10)
        
        formato_var = tk.StringVar(value="HTML")
        tk.Radiobutton(formato_frame, text="HTML", variable=formato_var, value="HTML", bg="#34495e", fg="white", selectcolor="#2c3e50").pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(formato_frame, text="JSON", variable=formato_var, value="JSON", bg="#34495e", fg="white", selectcolor="#2c3e50").pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(formato_frame, text="TXT", variable=formato_var, value="TXT", bg="#34495e", fg="white", selectcolor="#2c3e50").pack(side=tk.LEFT, padx=5)
        
        # Texto de resultado
        text_frame = tk.Frame(sim_window, bg="#ecf0f1")
        text_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        resultado_text = scrolledtext.ScrolledText(
            text_frame,
            font=("Consolas", 9),
            bg="#2c3e50",
            fg="#ecf0f1",
            wrap=tk.WORD
        )
        resultado_text.pack(fill=tk.BOTH, expand=True)
        
        def generar_simulacion():
            resultado_text.delete(1.0, tk.END)
            
            formato = formato_var.get()
            simulacion = self.generar_simulacion_datos(formato)
            
            resultado_text.insert(1.0, simulacion)
        
        def exportar_simulacion():
            formato = formato_var.get()
            simulacion = self.generar_simulacion_datos(formato)
            
            file_path = filedialog.asksaveasfilename(
                defaultextension=f".{formato.lower()}",
                filetypes=[(f"{formato} files", f"*.{formato.lower()}")]
            )
            
            if file_path:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(simulacion)
                messagebox.showinfo("Éxito", f"Simulación exportada a {file_path}")
        
        tk.Button(
            formato_frame,
            text="Generar",
            command=generar_simulacion,
            bg="#27ae60",
            fg="white",
            font=("Arial", 9, "bold"),
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=10)
        
        tk.Button(
            formato_frame,
            text="Exportar",
            command=exportar_simulacion,
            bg="#e67e22",
            fg="white",
            font=("Arial", 9, "bold"),
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=5)
        
        # Generar automáticamente
        generar_simulacion()
    
    def generar_simulacion_datos(self, formato):
        if self.datos_fuente_df is None:
            return "Error: No hay datos cargados"
        
        nombre_carpeta = datetime.now().strftime("evidencias_%d-%m-%y")
        carpeta_salida = self.carpeta_salida_path or "/evidencias"
        
        resultados = []
        
        for idx, cliente_row in self.datos_fuente_df.iterrows():
            nombre_cliente = str(cliente_row.get("NOMBRE", cliente_row.get("CLIENTE", "Sin nombre"))).strip()
            cuenta_cliente = str(cliente_row.get("CUENTA", "")).strip()
            gestion_efectiva = str(cliente_row.get("GESTION EFECTIVA", "")).strip()
            
            # Normalizar gestiones (siempre a mayúsculas)
            gestiones = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                         for g in gestion_efectiva.split(",") if g.strip()]
            
            # Si V2 está activo, combinar con nuevos_datos
            if self.v2_enabled.get() and self.nuevos_datos_df is not None:
                gestiones = self.obtener_gestiones_v2(cuenta_cliente, gestiones)
            
            # Generar lista de archivos que se crearán
            archivos = self.generar_lista_archivos(nombre_cliente, cuenta_cliente, gestiones)
            
            resultados.append({
                "id": idx + 1,
                "cliente": nombre_cliente,
                "cuenta": cuenta_cliente,
                "gestiones": gestiones,
                "archivos": archivos
            })
        
        if formato == "HTML":
            return self.generar_html_simulacion(resultados, carpeta_salida, nombre_carpeta)
        elif formato == "JSON":
            return json.dumps(resultados, indent=2, ensure_ascii=False)
        else:  # TXT
            return self.generar_txt_simulacion(resultados, carpeta_salida, nombre_carpeta)
    
    def generar_lista_archivos(self, nombre_cliente, cuenta_cliente, gestiones):
        """Genera la lista de archivos que se crearán para un cliente según sus gestiones"""
        archivos = []
        nombre_sanitizado = self.sanitize_filename(nombre_cliente)
        
        for gestion in gestiones:
            if gestion == "IVR":
                archivos.append(f"{nombre_sanitizado}_ivr.xlsx")
                archivos.append(f"ivr_{nombre_sanitizado}.mp3")
            elif gestion == "SMS":
                archivos.append(f"SMS_{nombre_sanitizado}.xlsx")
            elif gestion == "CALL":
                archivos.append(f"{nombre_sanitizado}_gestiones.xlsx")
                archivos.append(f"{nombre_sanitizado}_{cuenta_cliente}.mp3")
        
        return archivos
    
    def generar_html_simulacion(self, resultados, carpeta_salida, nombre_carpeta):
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Simulación de Evidencias</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
                h1 {{ color: #2c3e50; }}
                table {{ border-collapse: collapse; width: 100%; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                th {{ background: #34495e; color: white; }}
                tr:nth-child(even) {{ background: #f9f9f9; }}
                .generar-btn {{ background: #27ae60; color: white; padding: 5px 10px; border: none; cursor: pointer; border-radius: 3px; }}
                .generar-btn:hover {{ background: #229954; }}
                .archivos {{ font-size: 0.9em; color: #7f8c8d; margin-top: 5px; }}
                .archivo-item {{ margin: 2px 0; padding-left: 10px; }}
            </style>
        </head>
        <body>
            <h1>📋 Simulación de Evidencias</h1>
            <p><strong>Ruta:</strong> {carpeta_salida}</p>
            <p><strong>Carpeta:</strong> {nombre_carpeta}</p>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Gestiones</th>
                    <th>Archivos a crear</th>
                    <th>Acción</th>
                </tr>
        """
        
        for item in resultados[:100]:  # Limitar a 100 para no sobrecargar
            gestiones_str = ", ".join(item["gestiones"])
            archivos_html = "<div class='archivos'>"
            for archivo in item.get("archivos", []):
                archivos_html += f"<div class='archivo-item'>📄 {archivo}</div>"
            archivos_html += "</div>"
            
            html += f"""
                <tr>
                    <td>{item['id']}</td>
                    <td>{item['cliente']}</td>
                    <td>{gestiones_str}</td>
                    <td>{archivos_html}</td>
                    <td><button class="generar-btn" onclick="alert('Generar archivos para {item['cliente']}')">Generar Archivos</button></td>
                </tr>
            """
        
        html += """
            </table>
        </body>
        </html>
        """
        
        return html
    
    def generar_txt_simulacion(self, resultados, carpeta_salida, nombre_carpeta):
        txt = f"GESTIONES - Simulación de Resultado\n"
        txt += "=" * 120 + "\n\n"
        txt += f"Ruta: {carpeta_salida}\n"
        txt += f"Carpeta: {nombre_carpeta}\n\n"
        txt += f"{'ID':<5} | {'CLIENTE':<40} | {'GESTIONES':<30} | {'ARCHIVOS':<50}\n"
        txt += "-" * 120 + "\n"
        
        for item in resultados:
            gestiones_str = ", ".join(item["gestiones"])
            archivos_str = ", ".join(item.get("archivos", []))
            txt += f"{item['id']:<5} | {item['cliente'][:40]:<40} | {gestiones_str:<30} | {archivos_str[:50]:<50}\n"
            # Si hay muchos archivos, mostrar en líneas adicionales
            if len(item.get("archivos", [])) > 2:
                for archivo in item.get("archivos", []):
                    txt += f"{'':<5} | {'':<40} | {'':<30} |   📄 {archivo}\n"
        
        return txt
    
    def ejecutar_auditor(self):
        if not self.carpeta_salida_path:
            messagebox.showerror("Error", "Debe seleccionar carpeta de salida primero")
            return
        
        # Verificar si ya hay una ventana de auditoría abierta
        if hasattr(self, 'auditor_window_open') and self.auditor_window_open:
            messagebox.showinfo("Información", "La auditoría ya está en ejecución")
            return
        
        self.auditor_window_open = True
        
        try:
            self.log("🔍 Iniciando auditoría...")
            
            # Buscar carpeta de evidencias más reciente
            carpetas = [d for d in os.listdir(self.carpeta_salida_path) 
                        if os.path.isdir(os.path.join(self.carpeta_salida_path, d)) and "evidencias" in d]
            
            if not carpetas:
                messagebox.showwarning("Advertencia", "No se encontraron carpetas de evidencias")
                return
            
            carpeta_auditoria = os.path.join(self.carpeta_salida_path, carpetas[-1])
            
            reporte = self.auditar_carpetas(carpeta_auditoria)
            
            # Mostrar reporte y registrar que la ventana se cerró
            def on_window_close():
                self.auditor_window_open = False
            
            # Mostrar reporte
            self.mostrar_reporte_auditoria(reporte, on_window_close)
        except Exception as e:
            self.log(f"❌ Error en auditoría: {str(e)}")
            self.auditor_window_open = False
    
    def auditar_carpetas(self, carpeta_base):
        """Audita las carpetas y verifica que tengan los archivos correctos según sus gestiones"""
        reporte = {
            "total_carpetas": 0,
            "carpetas_ok": 0,
            "carpetas_error": [],
            "archivos_faltantes": []
        }
        
        # Obtener datos fuente para saber qué gestiones esperar
        if self.datos_fuente_df is None:
            messagebox.showwarning("Advertencia", "Debe cargar datos_fuente.xlsx para hacer auditoría completa")
        
        for carpeta_cliente in os.listdir(carpeta_base):
            carpeta_path = os.path.join(carpeta_base, carpeta_cliente)
            if os.path.isdir(carpeta_path):
                reporte["total_carpetas"] += 1
                
                archivos = os.listdir(carpeta_path)
                
                # Extraer nombre y cuenta del nombre de carpeta
                # Formato: "NOMBRE_CUENTA"
                partes_carpeta = carpeta_cliente.rsplit("_", 1)
                if len(partes_carpeta) >= 2:
                    cuenta_carpeta = partes_carpeta[-1]
                    
                    # Buscar cliente en datos_fuente para obtener gestiones esperadas
                    gestiones_esperadas = []
                    if self.datos_fuente_df is not None:
                        cuenta_col = None
                        gestion_col = None
                        nombre_col = None
                        
                        for col in self.datos_fuente_df.columns:
                            if "CUENTA" in str(col).upper():
                                cuenta_col = col
                            if "GESTION EFECTIVA" in str(col).upper():
                                gestion_col = col
                            if "NOMBRE" in str(col).upper() or "CLIENTE" in str(col).upper():
                                nombre_col = col
                        
                        if cuenta_col and gestion_col:
                            matches = self.datos_fuente_df[
                                self.datos_fuente_df[cuenta_col].astype(str).str.strip() == cuenta_carpeta
                            ]
                            
                            if len(matches) > 0:
                                gestion_efectiva = str(matches.iloc[0][gestion_col]).strip()
                                gestiones_esperadas = [g.strip().upper().replace("GRABACION CALL", "CALL") 
                                                      for g in gestion_efectiva.split(",") if g.strip()]
                                
                                # Si V2 está activo, combinar con nuevos_datos
                                if self.v2_enabled.get() and self.nuevos_datos_df is not None:
                                    gestiones_esperadas = self.obtener_gestiones_v2(cuenta_carpeta, gestiones_esperadas)
                
                # Verificar archivos según gestiones esperadas
                archivos_esperados = []
                archivos_encontrados = set(f.lower() for f in archivos)
                
                for gestion in gestiones_esperadas:
                    if gestion == "IVR":
                        archivos_esperados.append("ivr.xlsx")
                        archivos_esperados.append("ivr.mp3")
                    elif gestion == "SMS":
                        archivos_esperados.append("sms.xlsx")
                    elif gestion == "CALL":
                        archivos_esperados.append("gestiones.xlsx")
                        archivos_esperados.append(".mp3")  # Audio call (cualquier mp3 que no sea IVR)
                
                # Verificar archivos presentes
                tiene_ivr_excel = any("ivr" in f.lower() and f.endswith(".xlsx") for f in archivos)
                tiene_ivr_audio = any("ivr" in f.lower() and f.endswith(".mp3") for f in archivos)
                tiene_sms = any("sms" in f.lower() and f.endswith(".xlsx") for f in archivos)
                tiene_call_excel = any("gestiones" in f.lower() and f.endswith(".xlsx") for f in archivos)
                tiene_call_audio = any(f.endswith(".mp3") and "ivr" not in f.lower() for f in archivos)
                
                errores = []
                archivos_faltantes = []
                
                # Obtener nombre del cliente desde la carpeta
                nombre_cliente_desde_carpeta = carpeta_cliente.split("_")[0] if "_" in carpeta_cliente else carpeta_cliente
                
                # Verificar según gestiones esperadas (omitir archivos no creados por falta de match)
                if "IVR" in gestiones_esperadas:
                    # Excel IVR: omitir si está en ivr_sin_match
                    if not tiene_ivr_excel and nombre_cliente_desde_carpeta not in self.archivos_no_creados.get("ivr_sin_match", []):
                        errores.append("Falta Excel IVR")
                        archivos_faltantes.append("Archivo Excel IVR")
                    
                    # Audio IVR: SIEMPRE debe estar (es obligatorio), omitir solo si está en ivr_sin_audio
                    if not tiene_ivr_audio and nombre_cliente_desde_carpeta not in self.archivos_no_creados.get("ivr_sin_audio", []):
                        errores.append("Falta audio IVR (OBLIGATORIO)")
                        archivos_faltantes.append("Audio MP3 IVR")
                
                if "SMS" in gestiones_esperadas:
                    # SMS: omitir si está en sms_sin_match
                    if not tiene_sms and nombre_cliente_desde_carpeta not in self.archivos_no_creados.get("sms_sin_match", []):
                        errores.append("Falta Excel SMS")
                        archivos_faltantes.append("Archivo Excel SMS")
                
                if "CALL" in gestiones_esperadas:
                    # Excel CALL: omitir si está en call_sin_match (por falta de match en gestiones.xlsx)
                    # Pero SÍ mostrar si es por falta de match en numero_celular (ese sí se debe mostrar)
                    tiene_match_numero_celular = nombre_cliente_desde_carpeta in self.archivos_no_creados.get("call_sin_match", [])
                    
                    if not tiene_call_excel and not tiene_match_numero_celular:
                        # Solo mostrar error si no es por falta de match en gestiones.xlsx
                        # (no tenemos forma directa de saber esto, pero call_sin_match puede incluir ambos casos)
                        # Por ahora, mostramos el error si no tiene Excel y no está en call_sin_match
                        if nombre_cliente_desde_carpeta not in self.archivos_no_creados.get("call_sin_match", []):
                            errores.append("Falta Excel CALL")
                            archivos_faltantes.append("Archivo Excel gestiones")
                    
                    # Audio CALL: mostrar si no tiene (aunque esté en call_sin_match, eso es diferente)
                    if not tiene_call_audio:
                        if tiene_match_numero_celular:
                            errores.append("Falta audio CALL (Sin match en numero_celular)")
                            archivos_faltantes.append("Audio MP3 CALL")
                        elif nombre_cliente_desde_carpeta not in self.archivos_no_creados.get("call_sin_audio", []):
                            errores.append("Falta audio CALL")
                            archivos_faltantes.append("Audio MP3 CALL")
                
                # Verificar cantidad total de archivos
                num_archivos_esperados = len(archivos_esperados)
                if num_archivos_esperados > 0 and len(archivos) != num_archivos_esperados:
                    if len(archivos) < num_archivos_esperados:
                        errores.append(f"Faltan archivos: esperados {num_archivos_esperados}, encontrados {len(archivos)}")
                
                # Detectar carpetas vacías (siempre se muestra)
                if len(archivos) == 0:
                    errores.append("Carpeta vacía")
                    reporte["carpetas_error"].append({
                        "carpeta": carpeta_cliente,
                        "errores": ["Carpeta vacía"],
                        "gestiones_esperadas": gestiones_esperadas,
                        "archivos_faltantes": ["Todos los archivos"],
                        "archivos_encontrados": 0,
                        "archivos_esperados": num_archivos_esperados
                    })
                    continue  # Saltar verificación de archivos si la carpeta está vacía
                
                if errores:
                    reporte["carpetas_error"].append({
                        "carpeta": carpeta_cliente,
                        "errores": errores,
                        "gestiones_esperadas": gestiones_esperadas,
                        "archivos_faltantes": archivos_faltantes,
                        "archivos_encontrados": len(archivos),
                        "archivos_esperados": num_archivos_esperados
                    })
                else:
                    reporte["carpetas_ok"] += 1
        
        return reporte
    
    def mostrar_reporte_auditoria(self, reporte, on_close_callback=None):
        window = tk.Toplevel(self.root)
        window.title("Reporte de Auditoría")
        window.geometry("900x700")
        window.configure(bg="#f5f5f5")
        
        # Registrar callback cuando se cierre la ventana
        def on_closing():
            if on_close_callback:
                on_close_callback()
            window.destroy()
        
        window.protocol("WM_DELETE_WINDOW", on_closing)
        
        # Canvas con scrollbar
        main_canvas = tk.Canvas(window, bg="#f5f5f5", highlightthickness=0)
        scrollbar_y = ttk.Scrollbar(window, orient="vertical", command=main_canvas.yview)
        scrollable_frame = tk.Frame(main_canvas, bg="#f5f5f5")
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: main_canvas.configure(scrollregion=main_canvas.bbox("all"))
        )
        
        main_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        main_canvas.configure(yscrollcommand=scrollbar_y.set)
        
        main_canvas.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        scrollbar_y.pack(side="right", fill="y")
        
        # Header profesional
        header_frame = tk.Frame(scrollable_frame, bg="#2c3e50", pady=20, padx=20)
        header_frame.pack(fill=tk.X, pady=(0, 15))
        
        tk.Label(
            header_frame,
            text="📊 REPORTE DE AUDITORÍA",
            font=("Arial", 20, "bold"),
            bg="#2c3e50",
            fg="white"
        ).pack()
        
        # Resumen con cards profesionales
        resumen_frame = tk.Frame(scrollable_frame, bg="#ecf0f1", pady=15, padx=15, relief=tk.RAISED, bd=2)
        resumen_frame.pack(fill=tk.X, pady=10)
        
        stats_frame = tk.Frame(resumen_frame, bg="#ecf0f1")
        stats_frame.pack(fill=tk.X)
        
        # Card 1: Total
        card_total = tk.Frame(stats_frame, bg="#3498db", pady=15, padx=20, relief=tk.RAISED, bd=2)
        card_total.pack(side=tk.LEFT, padx=10, expand=True)
        tk.Label(card_total, text="📁 Total", font=("Arial", 10), bg="#3498db", fg="white").pack()
        tk.Label(card_total, text=str(reporte['total_carpetas']), font=("Arial", 24, "bold"), bg="#3498db", fg="white").pack()
        
        # Card 2: OK
        card_ok = tk.Frame(stats_frame, bg="#27ae60", pady=15, padx=20, relief=tk.RAISED, bd=2)
        card_ok.pack(side=tk.LEFT, padx=10, expand=True)
        tk.Label(card_ok, text="✅ Correctas", font=("Arial", 10), bg="#27ae60", fg="white").pack()
        tk.Label(card_ok, text=str(reporte['carpetas_ok']), font=("Arial", 24, "bold"), bg="#27ae60", fg="white").pack()
        
        # Card 3: Errores
        card_errores = tk.Frame(stats_frame, bg="#e74c3c", pady=15, padx=20, relief=tk.RAISED, bd=2)
        card_errores.pack(side=tk.LEFT, padx=10, expand=True)
        tk.Label(card_errores, text="❌ Con Errores", font=("Arial", 10), bg="#e74c3c", fg="white").pack()
        tk.Label(card_errores, text=str(len(reporte['carpetas_error'])), font=("Arial", 24, "bold"), bg="#e74c3c", fg="white").pack()
        
        # Botón crear archivos faltantes
        if reporte['carpetas_error']:
            botones_frame = tk.Frame(scrollable_frame, bg="#f5f5f5", pady=10)
            botones_frame.pack(fill=tk.X, padx=10)
            
            tk.Button(
                botones_frame,
                text="🔧 Crear Archivos Faltantes",
                command=lambda: self.crear_archivos_faltantes(reporte, window),
                bg="#8e44ad",
                fg="white",
                font=("Arial", 12, "bold"),
                pady=10,
                cursor="hand2"
            ).pack(side=tk.LEFT, padx=5)
            
            tk.Button(
                botones_frame,
                text="📄 Exportar HTML",
                command=lambda: self.exportar_reporte_html(reporte),
                bg="#e67e22",
                fg="white",
                font=("Arial", 11, "bold"),
                pady=8,
                cursor="hand2"
            ).pack(side=tk.LEFT, padx=5)
        
        # Área de errores con acordeones
        if reporte['carpetas_error']:
            errores_container = tk.Frame(scrollable_frame, bg="#f5f5f5")
            errores_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
            
            tk.Label(
                errores_container,
                text="📋 DETALLE DE ERRORES",
                font=("Arial", 14, "bold"),
                bg="#f5f5f5",
                fg="#2c3e50"
            ).pack(anchor=tk.W, pady=(0, 10))
            
            # Crear acordeones para cada error
            self.acordeones_auditoria = []
            for idx, error_item in enumerate(reporte['carpetas_error']):
                acordeon = self.crear_acordeon_auditoria(errores_container, error_item, idx)
                self.acordeones_auditoria.append(acordeon)
        else:
            success_frame = tk.Frame(scrollable_frame, bg="#d4edda", pady=30, padx=30, relief=tk.RAISED, bd=2)
            success_frame.pack(fill=tk.X, pady=20, padx=10)
            
            tk.Label(
                success_frame,
                text="✅ Todas las carpetas están correctas",
                font=("Arial", 16, "bold"),
                bg="#d4edda",
                fg="#155724"
            ).pack()
        
        # Configurar scroll con mouse wheel
        main_canvas.bind_all("<MouseWheel>", lambda e: main_canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
    
    def crear_acordeon_auditoria(self, parent, error_item, idx):
        """Crea un acordeón para cada error de auditoría"""
        acordeon_frame = tk.Frame(parent, bg="#ecf0f1", relief=tk.RAISED, bd=1)
        acordeon_frame.pack(fill=tk.X, pady=5)
        
        # Header del acordeón
        header = tk.Frame(acordeon_frame, bg="#34495e", pady=10, padx=15)
        header.pack(fill=tk.X)
        
        toggle_var = tk.BooleanVar(value=False)
        
        def toggle():
            if toggle_var.get():
                content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
                toggle_btn.config(text="▼")
            else:
                content_frame.pack_forget()
                toggle_btn.config(text="▶")
        
        header_info = tk.Frame(header, bg="#34495e")
        header_info.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        tk.Label(
            header_info,
            text=f"📁 {error_item['carpeta']}",
            font=("Arial", 11, "bold"),
            bg="#34495e",
            fg="white"
        ).pack(anchor=tk.W)
        
        gestiones_str = ", ".join(error_item.get('gestiones_esperadas', []))
        tk.Label(
            header_info,
            text=f"Gestiones: {gestiones_str} | Archivos: {error_item.get('archivos_encontrados', 0)}/{error_item.get('archivos_esperados', 0)}",
            font=("Arial", 9),
            bg="#34495e",
            fg="#ecf0f1"
        ).pack(anchor=tk.W)
        
        toggle_btn = tk.Button(
            header,
            text="▶",
            command=lambda: [toggle_var.set(not toggle_var.get()), toggle()],
            bg="#27ae60",
            fg="white",
            font=("Arial", 12),
            width=3,
            cursor="hand2"
        )
        toggle_btn.pack(side=tk.RIGHT, padx=10)
        
        # Contenido del acordeón
        content_frame = tk.Frame(acordeon_frame, bg="#ffffff", padx=15, pady=10)
        
        # Detalles
        detalles_text = scrolledtext.ScrolledText(content_frame, height=8, width=80, wrap=tk.WORD, font=("Arial", 9))
        detalles_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        detalles_text.insert(tk.END, f"📋 CARPETA: {error_item['carpeta']}\n")
        detalles_text.insert(tk.END, f"{'='*60}\n\n")
        
        gestiones_str = ", ".join(error_item.get('gestiones_esperadas', []))
        detalles_text.insert(tk.END, f"🔍 Gestiones esperadas: {gestiones_str}\n")
        detalles_text.insert(tk.END, f"📊 Archivos encontrados: {error_item.get('archivos_encontrados', 0)}\n")
        detalles_text.insert(tk.END, f"📊 Archivos esperados: {error_item.get('archivos_esperados', 0)}\n\n")
        
        detalles_text.insert(tk.END, "❌ ERRORES ENCONTRADOS:\n")
        detalles_text.insert(tk.END, f"{'-'*60}\n")
        for error in error_item['errores']:
            detalles_text.insert(tk.END, f"  • {error}\n")
        
        if error_item.get('archivos_faltantes'):
            detalles_text.insert(tk.END, f"\n📄 ARCHIVOS FALTANTES:\n")
            detalles_text.insert(tk.END, f"{'-'*60}\n")
            for archivo in error_item['archivos_faltantes']:
                detalles_text.insert(tk.END, f"  • {archivo}\n")
        
        detalles_text.config(state=tk.DISABLED)
        
        # Botón para crear archivos de este cliente
        if error_item.get('archivos_faltantes'):
            btn_crear = tk.Button(
                content_frame,
                text=f"🔧 Crear Archivos para {error_item['carpeta']}",
                command=lambda: self.crear_archivos_cliente(error_item),
                bg="#27ae60",
                fg="white",
                font=("Arial", 10, "bold"),
                pady=5,
                cursor="hand2"
            )
            btn_crear.pack(pady=5)
        
        return acordeon_frame
    
    def crear_archivos_cliente(self, error_item):
        """Crea los archivos faltantes para un cliente específico"""
        carpeta_cliente = error_item['carpeta']
        gestiones_esperadas = error_item.get('gestiones_esperadas', [])
        archivos_faltantes = error_item.get('archivos_faltantes', [])
        
        # Buscar carpeta del cliente
        carpetas = [d for d in os.listdir(self.carpeta_salida_path) 
                    if os.path.isdir(os.path.join(self.carpeta_salida_path, d)) and "evidencias" in d]
        
        if not carpetas:
            messagebox.showerror("Error", "No se encontraron carpetas de evidencias")
            return
        
        carpeta_evidencias = os.path.join(self.carpeta_salida_path, carpetas[-1])
        carpeta_cliente_path = os.path.join(carpeta_evidencias, carpeta_cliente)
        
        if not os.path.exists(carpeta_cliente_path):
            messagebox.showerror("Error", f"No se encontró la carpeta: {carpeta_cliente_path}")
            return
        
        # Extraer cuenta del nombre de carpeta
        partes = carpeta_cliente.rsplit("_", 1)
        cuenta_cliente = partes[-1] if len(partes) > 1 else ""
        
        # Buscar cliente en datos_fuente
        if self.datos_fuente_df is None:
            messagebox.showerror("Error", "Debe cargar datos_fuente.xlsx primero")
            return
        
        cliente_row = None
        cuenta_col = None
        nombre_col = None
        
        for col in self.datos_fuente_df.columns:
            if "CUENTA" in str(col).upper():
                cuenta_col = col
            if "NOMBRE" in str(col).upper() or "CLIENTE" in str(col).upper():
                nombre_col = col
        
        if cuenta_col:
            matches = self.datos_fuente_df[
                self.datos_fuente_df[cuenta_col].astype(str).str.strip() == cuenta_cliente
            ]
            if len(matches) > 0:
                cliente_row = matches.iloc[0]
        
        if cliente_row is None:
            messagebox.showerror("Error", f"No se encontró el cliente con cuenta {cuenta_cliente}")
            return
        
        nombre_cliente = str(cliente_row.get(nombre_col or "NOMBRE", carpeta_cliente.split("_")[0])).strip()
        
        # Crear archivos faltantes
        creados = 0
        for gestion in gestiones_esperadas:
            if gestion == "IVR" and "IVR" in " ".join(archivos_faltantes):
                try:
                    self.procesar_ivr(cliente_row, carpeta_cliente_path, nombre_cliente)
                    creados += 1
                except Exception as e:
                    self.log(f"❌ Error creando IVR para {carpeta_cliente}: {str(e)}")
            
            elif gestion == "SMS" and "SMS" in " ".join(archivos_faltantes):
                try:
                    self.procesar_sms(cliente_row, carpeta_cliente_path, nombre_cliente)
                    creados += 1
                except Exception as e:
                    self.log(f"❌ Error creando SMS para {carpeta_cliente}: {str(e)}")
            
            elif gestion == "CALL" and "CALL" in " ".join(archivos_faltantes):
                try:
                    self.procesar_call(cliente_row, carpeta_cliente_path, nombre_cliente, cuenta_cliente)
                    creados += 1
                except Exception as e:
                    self.log(f"❌ Error creando CALL para {carpeta_cliente}: {str(e)}")
        
        if creados > 0:
            messagebox.showinfo("Éxito", f"Se crearon {creados} archivo(s) para {carpeta_cliente}")
            self.ejecutar_auditor()  # Re-ejecutar auditoría
        else:
            messagebox.showwarning("Advertencia", "No se pudieron crear los archivos faltantes")
    
    def crear_archivos_faltantes(self, reporte, window_auditor):
        """Crea todos los archivos faltantes para todas las carpetas con errores"""
        respuesta = messagebox.askyesno(
            "Confirmar",
            f"¿Desea crear los archivos faltantes para {len(reporte['carpetas_error'])} carpeta(s)?"
        )
        
        if not respuesta:
            return
        
        self.log("🔧 Iniciando creación de archivos faltantes...")
        total_creados = 0
        
        for error_item in reporte['carpetas_error']:
            try:
                self.crear_archivos_cliente(error_item)
                total_creados += 1
            except Exception as e:
                self.log(f"❌ Error creando archivos para {error_item['carpeta']}: {str(e)}")
        
        self.log(f"✅ Creación completada: {total_creados} carpeta(s) procesada(s)")
        messagebox.showinfo("Éxito", f"Se procesaron {total_creados} carpeta(s)")
        
        # Re-ejecutar auditoría
        window_auditor.destroy()
        self.ejecutar_auditor()
    
    def exportar_reporte_html(self, reporte):
        """Exporta el reporte de auditoría en formato HTML"""
        file_path = filedialog.asksaveasfilename(
            defaultextension=".html",
            filetypes=[("HTML files", "*.html")]
        )
        
        if not file_path:
            return
        
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Auditoría - Evidencias</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .stats {{ display: flex; gap: 20px; margin: 20px 0; }}
        .stat-card {{ flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }}
        .stat-card.total {{ border-top: 4px solid #3498db; }}
        .stat-card.ok {{ border-top: 4px solid #27ae60; }}
        .stat-card.error {{ border-top: 4px solid #e74c3c; }}
        .stat-number {{ font-size: 36px; font-weight: bold; margin: 10px 0; }}
        .error-section {{ margin-top: 30px; }}
        .acordeon {{ background: white; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }}
        .acordeon-header {{ background: #34495e; color: white; padding: 15px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }}
        .acordeon-header:hover {{ background: #2c3e50; }}
        .acordeon-content {{ padding: 20px; display: none; }}
        .acordeon-content.active {{ display: block; }}
        .error-list {{ list-style: none; padding-left: 0; }}
        .error-list li {{ padding: 8px; margin: 5px 0; background: #fee; border-left: 3px solid #e74c3c; }}
        .success {{ background: #d4edda; color: #155724; padding: 20px; border-radius: 8px; text-align: center; font-size: 18px; margin-top: 30px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Reporte de Auditoría - Evidencias</h1>
            <p>Fecha: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card total">
                <div class="stat-label">📁 Total Carpetas</div>
                <div class="stat-number">{reporte['total_carpetas']}</div>
            </div>
            <div class="stat-card ok">
                <div class="stat-label">✅ Correctas</div>
                <div class="stat-number">{reporte['carpetas_ok']}</div>
            </div>
            <div class="stat-card error">
                <div class="stat-label">❌ Con Errores</div>
                <div class="stat-number">{len(reporte['carpetas_error'])}</div>
            </div>
        </div>
"""
        
        if reporte['carpetas_error']:
            html += '<div class="error-section"><h2 style="margin-bottom: 20px;">📋 Detalle de Errores</h2>'
            
            for idx, error_item in enumerate(reporte['carpetas_error']):
                gestiones_str = ", ".join(error_item.get('gestiones_esperadas', []))
                html += f"""
                <div class="acordeon">
                    <div class="acordeon-header" onclick="toggleAcordeon({idx})">
                        <div>
                            <strong>📁 {error_item['carpeta']}</strong>
                            <div style="font-size: 12px; margin-top: 5px;">Gestiones: {gestiones_str} | Archivos: {error_item.get('archivos_encontrados', 0)}/{error_item.get('archivos_esperados', 0)}</div>
                        </div>
                        <span id="toggle-{idx}">▶</span>
                    </div>
                    <div class="acordeon-content" id="content-{idx}">
                        <h3>Detalles</h3>
                        <ul class="error-list">
"""
                for error in error_item['errores']:
                    html += f"<li>❌ {error}</li>"
                
                if error_item.get('archivos_faltantes'):
                    html += "<li><strong>Archivos faltantes:</strong> " + ", ".join(error_item['archivos_faltantes']) + "</li>"
                
                html += """
                        </ul>
                    </div>
                </div>
"""
            
            html += '</div>'
        else:
            html += '<div class="success">✅ Todas las carpetas están correctas</div>'
        
        html += """
    </div>
    <script>
        function toggleAcordeon(idx) {
            const content = document.getElementById('content-' + idx);
            const toggle = document.getElementById('toggle-' + idx);
            if (content.classList.contains('active')) {
                content.classList.remove('active');
                toggle.textContent = '▶';
            } else {
                content.classList.add('active');
                toggle.textContent = '▼';
            }
        }
    </script>
</body>
</html>
"""
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        messagebox.showinfo("Éxito", f"Reporte exportado a {file_path}")


if __name__ == "__main__":
    root = tk.Tk()
    app = EvidenciasApp(root)
    root.mainloop()

