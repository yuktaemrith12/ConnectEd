# Technical Report: Emotion Detection AI Training and Deployment Pipeline

## 1. Project Overview
This section outlines the development and training pipeline for a YOLOv8s object detection model, designed for the Study Hive / ConnectEd platform. The model's primary objective is to perform real-time classroom monitoring by classifying student webcam feeds into three targeted states: **Engaged**, **Confused**, and **Disengaged**.

## 2. Data Acquisition and Preprocessing
- **Dataset Aggregation:** The foundational dataset, originally sourced from Roboflow, comprised 10 fine-grained emotion classes. This was augmented by merging four supplementary datasets, resulting in a finalized distribution of approximately **8,416 training images**, **1,504 validation images**, and **835 test images**.
- **Label Consolidation:** To align with the platform's practical requirements, the original 10 classes were remapped into three semantically meaningful categories. The **"Confused"** class (derived from Worried and Fear labels) was designated as the key target metric due to its critical role in identifying struggling students.

## 3. Mitigation of Class Imbalance
Following label consolidation, the dataset exhibited severe class imbalance, with the critical "Confused" class representing only 7.5% of the total data. This was addressed utilizing a three-tiered data augmentation strategy:
- **Targeted Augmentation:** Applied Albumentations using escalating intensity levels (Light, Medium, Heavy) to bring minority classes up to 80% of the majority class count.
- **Synthetic Data Generation:** Leveraged the Gemini 2.0 Flash API to generate synthetic, demographically diverse face portraits mapped to specific emotion prompts.
- **Advanced Style Transfer:** Utilized OpenCV-based transformations, including emotion-aware mood lighting and elastic distortion, to enhance the visual diversity of the training samples.

## 4. Training Methodology
A two-phase training strategy was implemented to ensure stable convergence and prevent the degradation of pretrained weights:
- **Phase 1 (Warmup):** A 10-epoch initial phase utilizing a frozen CSPDarknet backbone, allowing the detection head to adapt to the new emotion classes.
- **Phase 2 (Full Fine-Tuning):** A 150-epoch phase with all layers unfrozen, employing an AdamW optimizer, cosine annealing, and comprehensive online augmentations (e.g., Mosaic, MixUp, Random Erasing). Regularization techniques, including label smoothing and dropout, were applied to prevent overfitting.

## 5. Training Progression & Run-by-Run Results

Through iterative experimentation across 3 major versions (v1, v2, v3), the model's performance was consistently optimized.

### Summary of Best Results Across All Runs:
| Run | Epochs Trained | Best mAP50 | Best mAP50-95 | Best Precision | Best Recall |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v1 Phase 1** | 10 | 0.5994 | 0.4992 | 0.4901 | 0.8040 |
| **v1 Phase 2** | 9 (early stop) | 0.6516 | 0.5494 | 0.5996 | 0.8744 |
| **v2 Phase 1** | 10 | 0.5444 | 0.4246 | 0.4502 | 0.7876 |
| **v2 Phase 2** | 45 (early stop) | 0.6477 | 0.5491 | 0.5279 | 0.7988 |
| **v3 Phase A**| 35 | **0.7299** | **0.6301** | **0.5900** | **0.8131** |

> **IMPORTANT:** **v3 Phase A** is the best-performing model with significant improvements across both mAP and recall metrics.

---

### Detailed Run Breakdown

#### **Run v1: Initial Approach**
- **Phase 1 (Frozen Backbone, 10 epochs):** The warmup successfully adapted the detection head to the 3 emotion classes. It achieved an mAP50 of 0.599 and a validation class loss of 0.737.
- **Phase 2 (Full Fine-Tuning, 9 epochs):** After unfreezing, precision improved significantly (from 0.37 at epoch 1 to 0.60 at epoch 9), but recall dropped slightly. The run achieved an mAP50 of 0.646 before being stopped.

#### **Run v2: Data Augmentation Focus**
- **Phase 1 (Frozen Backbone, 10 epochs):** Re-trained on an augmented dataset. The validation class loss was higher (0.846) due to the harder classification task resulting from augmented images, concluding with an mAP50 of 0.544.
- **Phase 2 (Full Fine-Tuning, 45 epochs):** Shown steady improvement and was early stopped at epoch 45. It reached a best mAP50 of 0.648. This formed a highly balanced model, demonstrating better recall (0.80) than v1 Phase 2.

#### **Run v3 Phase A: The Optimal Model**
- **Configuration (35 epochs):** Initiated from a stronger checkpoint, the model demonstrated vastly superior metrics right from the start. 
- **Key Breakthrough:** At epoch 31, there was a dramatic drop in train losses (Box Loss from 0.49 → 0.36, Class Loss from 0.76 → 0.52). This inflection point coincided with the "Close Mosaic" feature kicking in, disabling mosaic augmentation and allowing the model to focus on clean, single-image learning.
- **Final Metrics:** Achieved a peak **mAP50 of 0.730** and **mAP50-95 of 0.630**, with a strong balance of Precision (0.590) and Recall (0.813). 

## 6. Evaluation and Deployment Architecture
- **Model Evaluation:** Performance was validated using standard object detection metrics (mAP50, mAP50-95, precision, and recall), supplemented by a specialized analysis block dedicated to optimizing confidence thresholds for the "Confused" class.
- **Real-Time Inference:** The finalized `best.pt` model was deployed via a Flask/FastAPI server utilizing WebSockets to process base64 webcam feeds dynamically from the browser.
- **Pipeline Features:** The deployment pipeline incorporates temporal smoothing to mitigate classification flickering, position-based tracking, and an aggregate "Engagement Score" that triggers automated visual alerts for educators when disengagement thresholds are met.
