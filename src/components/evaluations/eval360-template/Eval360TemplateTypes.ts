import type { Evaluation360TemplateItemData, Evaluation360TemplateCategoryData } from "@/types/evaluation"

export interface ItemState extends Evaluation360TemplateItemData {
  maxScore: number
}

export interface CategoryState extends Omit<Evaluation360TemplateCategoryData, 'items'> {
  isExpanded: boolean
  items: ItemState[]
}

export interface Grade {
  id: string
  name: string
  level: number
}

export interface JobType {
  id: string
  name: string
}
